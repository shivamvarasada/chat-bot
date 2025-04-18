import { useState, useEffect, useRef } from 'react';

export const meta = () => {
  return [{ title: "Dalal" }];
};

export default function Index() {
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Welcome to Dalal 2.0! Fastest Dalal to assist you.' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [botStatus, setBotStatus] = useState({ ready: false, processed_files: [] });
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/status/');
        const data = await response.json();
        setBotStatus(data);
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 5000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('border-blue-400');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-400');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-400');
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      console.log("Files dropped:", droppedFiles.map(f => f.name));
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    );
    
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      console.log("Files selected:", selectedFiles.map(f => f.name));
    }
  };

  const browseFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleUploadBoxClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input reference is not available");
    }
  };

  const uploadFiles = async (e) => {
    e.preventDefault();
    
    if (files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const response = await fetch('http://localhost:8000/upload-pdfs/', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      setMessages(prev => [
        ...prev, 
        { 
          role: 'system', 
          content: `Processing PDFs: ${result.files.join(', ')}` 
        }
      ]);
      setFiles([]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'system', 
          content: 'Failed to upload PDFs.' 
        }
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!userInput.trim() || isProcessing) return;
    
    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('http://localhost:8000/query/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userInput }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        setMessages(prev => [...prev, { role: 'system', content: result.error }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.answer,
          source: result.source 
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'system', 
          content: 'Failed to get a response.' 
        }
      ]);
    } finally {
      setIsProcessing(false);
      setUserInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <header className="py-4 px-6 bg-white border-b flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Dalal 2.0</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 p-5 bg-white border-r overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-3">Upload PDFs</h2>
            <div 
              className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-blue-400"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
                accept=".pdf"
              />
              <div className="mb-2" onClick={browseFiles}>
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <button 
                onClick={browseFiles} 
                className="text-sm mb-1 hover:underline"
              >
                Drag & drop PDFs here
              </button>
              <p className="text-xs text-gray-500">or click to browse</p>
            </div>
            
            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Selected Files:</h3>
                <ul className="text-xs space-y-1">
                  {files.map((file, index) => (
                    <li key={index} className="truncate">
                      {file.name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={uploadFiles}
                  disabled={isUploading}
                  className="mt-3 w-full py-2 px-4 rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-medium mb-3">Processed Files</h2>
            {botStatus.processed_files.length === 0 ? (
              <p className="text-sm text-gray-500">No files processed</p>
            ) : (
              <ul className="text-sm space-y-1">
                {botStatus.processed_files.map((file, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="truncate">{file}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className={`mt-4 py-2 px-3 rounded ${
              botStatus.ready 
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              <div className="flex items-center">
                <div className={`h-2 w-2 rounded-full mr-2 ${
                  botStatus.ready ? 'bg-green-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-sm">
                  {botStatus.ready ? 'Dalal is ready to assist' : 'Processing documents...'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col bg-gray-100">
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : msg.role === 'system'
                          ? 'bg-gray-200 text-gray-800'
                          : 'bg-white text-gray-800'
                    }`}
                  >
                    <div>{msg.content}</div>
                    {msg.role === 'assistant' && msg.source && (
                      <div className={`text-xs mt-1 ${
                        msg.source === 'document' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        Source: {msg.source === 'document' ? 'Uploaded PDFs' : 'General Knowledge'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-4 py-2 bg-white">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-gray-200">
            <form onSubmit={sendMessage} className="max-w-3xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={!botStatus.ready || isProcessing}
                  placeholder={botStatus.ready ? "Ask a question about your documents..." : "Upload PDFs to start chatting..."}
                  className="flex-1 rounded-md px-4 py-2 bg-white border-gray-300 border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!botStatus.ready || isProcessing || !userInput.trim()}
                  className="rounded-md px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}