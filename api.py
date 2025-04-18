import os
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tempfile
import shutil
from main import extract_text_from_pdf
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import CharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import RetrievalQA

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


global_qa = None
global_llm = None
processed_files = []

class QueryRequest(BaseModel):
    query: str

@app.post("/upload-pdfs/")
async def upload_pdfs(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    global processed_files
    processed_files = []
    
    temp_dir = tempfile.mkdtemp()
    temp_file_paths = []
    
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            continue
            
        temp_path = os.path.join(temp_dir, file.filename)
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        temp_file_paths.append(temp_path)
        processed_files.append(file.filename)
    
    background_tasks.add_task(process_pdfs, temp_file_paths, temp_dir)
    
    return JSONResponse(
        content={"message": f"Processing {len(temp_file_paths)} PDF files", "files": processed_files}
    )

def process_pdfs(pdf_paths, temp_dir):
    global global_qa, global_llm, processed_files
    
    try:
        all_texts = []
        for pdf_path in pdf_paths:
            text = extract_text_from_pdf(pdf_path)
            all_texts.append(text)
        
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        combined_text = "\n\n==== NEW DOCUMENT ====\n\n".join(all_texts)
        
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        docs = splitter.create_documents([combined_text])
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        
        persist_directory = "./chroma_db"
        if os.path.exists(persist_directory):
            shutil.rmtree(persist_directory)
            
        vectordb = Chroma.from_documents(docs, embeddings, persist_directory=persist_directory)
        retriever = vectordb.as_retriever()
        
        global_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")
        global_qa = RetrievalQA.from_chain_type(
            llm=global_llm,
            retriever=retriever
        )
        print("PDF processing complete - QA system ready")
    except Exception as e:
        print(f"Error in processing PDFs: {e}")
        processed_files = []
        global_qa = None
        global_llm = None

@app.post("/query/")
async def query(request: QueryRequest):
    global global_qa, global_llm
    
    if global_qa is None:
        return JSONResponse(
            content={"error": "No PDFs have been processed"}
        )
    
    query = request.query
    answer_doc = global_qa.invoke({"query": query})
    result_doc = answer_doc["result"].strip()
    result_llm = global_llm.invoke(query).content.strip()
    
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
    
    response = {
        "answer": result_doc if not doc_empty else (result_llm if not llm_empty else "No relevant answer found"),
        "source": "document" if not doc_empty else ("general knowledge" if not llm_empty else "none"),
        
        "processed_files": processed_files
    }
    
    return response

@app.get("/status/")
async def status():
    global processed_files
    return {
        "ready": global_qa is not None,
        "processed_files": processed_files
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
