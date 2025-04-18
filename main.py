import os
import sys
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import CharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import RetrievalQA
from pypdf import PdfReader
import shutil
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    print("Error: GOOGLE_API_KEY not found in environment variables.")
    sys.exit(1)

os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

def extract_text_from_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def main():
    print("Enter paths to PDF files (type 'done' when finished):")
    pdf_paths = []
    while True:
        path = input("PDF path (or 'done'): ").strip()
        if path.lower() == 'done':
            break
        if not os.path.exists(path):
            print(f"File not found: {path}")
            continue
        pdf_paths.append(path)
    
    if not pdf_paths:
        print("No valid PDF paths provided.")
        sys.exit(1)
    
    persist_directory = "./chroma_db"
    
    if os.path.exists(persist_directory):
        shutil.rmtree(persist_directory)
    
    all_texts = []
    for pdf_path in pdf_paths:
        print(f"Processing: {pdf_path}")
        text = extract_text_from_pdf(pdf_path)
        all_texts.append(text)
    
    combined_text = "\n\n==== NEW DOCUMENT ====\n\n".join(all_texts)
    
    splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = splitter.create_documents([combined_text])
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    
    vectordb = Chroma.from_documents(docs, embeddings, persist_directory=persist_directory)
    retriever = vectordb.as_retriever()
    qa = RetrievalQA.from_chain_type(
        llm=ChatGoogleGenerativeAI(model="gemini-2.0-flash"), 
        retriever=retriever
    )
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash") 
    print("Ask questions.")
    while True:
        query = input("Ask: ")
        if query.lower() == "exit":
            break
        answer_doc = qa.invoke({"query": query})
        result_doc = answer_doc["result"].strip()
        result_llm = llm.invoke(query).content.strip()
        

        doc_empty = not result_doc or any(x in result_doc.lower() for x in [
            "i don't know", "i do not know", "no relevant information", "not found", 
            "cannot answer", "i am unable", "i cannot find", "i am sorry", "cannot provide", 
            "does not contain information", "document does not contain", "no information", 
            "is not mentioned", "is not available", "no mention of", "not available in"
        ])
        llm_empty = not result_llm or any(x in result_llm.lower() for x in [
            "i don't know", "i do not know", "no relevant information", "not found", 
            "cannot answer", "i am unable", "i cannot find"
        ])
        
        
        if not doc_empty:
            print(f"\n{result_doc}")
        elif not llm_empty:
            print(f"\n{result_llm}")
        else:
            print("\nNo relevant answer found in document or general knowledge.")

if __name__ == "__main__":
    main()