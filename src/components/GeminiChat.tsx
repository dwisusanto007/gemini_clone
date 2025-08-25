'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
// import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { Send, Bot, User, Sparkles, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  content?: string; // For text extracted from PDF
}

export default function GeminiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [blobUrls, setBlobUrls] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string>('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [processingAttachments, setProcessingAttachments] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileReadersRef = useRef<FileReader[]>([]);
  const isMountedRef = useRef(true);
  const blobUrlsRef = useRef<string[]>([]);

  // No client API key validation needed; handled server-side
  useEffect(() => {
    setApiError('');
  }, []);

  // ... no test API helper in production UI

  const pushLog = (msg: string) => {
    const line = `${new Date().toISOString()} - ${msg}`;
    setLogs(prev => [...prev.slice(-49), line]);
    console.log(line);
  };

  // No longer needed: GenAI instance is server-side

  // Cleanup on unmount (run only once)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup file readers
      fileReadersRef.current.forEach(reader => {
        if (reader.readyState === FileReader.LOADING) {
          reader.abort();
        }
      });
      fileReadersRef.current = [];

      // Cleanup blob URLs tracked in ref
      blobUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (_) {}
      });
      blobUrlsRef.current = [];
    };
  }, []);

  // Keep a ref in sync with latest blobUrls so cleanup can access it
  useEffect(() => {
    blobUrlsRef.current = blobUrls;
  }, [blobUrls]);

  // Initialize PDF.js worker
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        
        // Prefer a local worker served from /pdf.worker.min.js (place file in public/)
        const localWorker = '/pdf.worker.min.js';

        // CDN fallbacks using the library version
        const cdnPrimary = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        const fallbackWorkerSrcs = [
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`,
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`,
          // Generic fallback without version
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        ];

        // Helper to test a given workerSrc
        const testWorker = async (src: string) => {
          try {
            pdfjs.GlobalWorkerOptions.workerSrc = src;
            const testArray = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            await pdfjs.getDocument({ data: testArray }).promise.catch(() => {});
            return true;
          } catch (e) {
            return false;
          }
        };

        // Try local worker first (recommended)
        if (await testWorker(localWorker)) {
          setPdfJsLoaded(true);
          console.log('PDF.js worker loaded successfully from local /pdf.worker.min.js');
        } else {
          // Try CDN primary
          if (await testWorker(cdnPrimary)) {
            setPdfJsLoaded(true);
            console.log('PDF.js worker loaded successfully from CDN primary:', cdnPrimary);
          } else {
            // Try remaining fallbacks
            let loaded = false;
            for (const fallbackSrc of fallbackWorkerSrcs) {
              if (await testWorker(fallbackSrc)) {
                setPdfJsLoaded(true);
                console.log(`PDF.js worker loaded successfully from fallback: ${fallbackSrc}`);
                loaded = true;
                break;
              }
            }

            if (!loaded && !pdfJsLoaded) {
              // If worker couldn't be loaded, pdfjs will fall back to fake worker (runs on main thread)
              console.warn('All PDF.js worker sources failed; pdf.js will use a fake worker on the main thread (slower).');
              setPdfJsLoaded(false);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
        setPdfJsLoaded(false);
      }
    };
    loadPdfJs();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // File processing functions
  const processImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Validate image size for processing
      const maxImageSize = 5 * 1024 * 1024; // 5MB for images to prevent memory issues
      if (file.size > maxImageSize) {
        reject(new Error('Gambar terlalu besar untuk diproses. Maksimal 5MB untuk analisis gambar.'));
        return;
      }

      const reader = new FileReader();
      // Track reader for cleanup
      fileReadersRef.current.push(reader);
      
    reader.onload = (e) => {
        try {
      pushLog(`Image FileReader onload for ${file.name}`);
          console.log('Image FileReader onload triggered');
          const base64 = e.target?.result as string;
          if (!base64) {
            console.error('No base64 result from FileReader');
            reject(new Error('Tidak dapat membaca file gambar'));
            return;
          }
          
          console.log('Base64 data received, length:', base64.length);
          const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
          if (!base64Data) {
            console.error('Invalid base64 format after split');
            pushLog(`Invalid base64 for ${file.name}`);
            reject(new Error('Format gambar tidak valid'));
            return;
          }
          
          pushLog(`Image processed: ${file.name} size=${file.size}`);
          console.log('Image processing successful, clean base64 length:', base64Data.length);
          resolve(base64Data);
        } catch (error) {
          console.error('Error in image processing:', error);
          reject(new Error('Error memproses gambar'));
        } finally {
          // Remove reader from tracking
          fileReadersRef.current = fileReadersRef.current.filter(r => r !== reader);
        }
      };
      reader.onerror = () => {
  fileReadersRef.current = fileReadersRef.current.filter(r => r !== reader);
  pushLog(`FileReader error for ${file.name}`);
  reject(new Error(`Tidak dapat membaca file "${file.name}"`));
      };
      reader.readAsDataURL(file);
    });
  };

  const processPDF = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!pdfJsLoaded) {
  pushLog(`PDF.js not loaded when processing ${file.name}`);
  resolve('Error: PDF processor belum siap. Silakan coba lagi dalam beberapa detik.');
        return;
      }

      const reader = new FileReader();
      // Track reader for cleanup
      fileReadersRef.current.push(reader);
      
    reader.onload = async (e) => {
        let pdf: any = null;
        try {
      pushLog(`PDF reader onload: ${file.name}`);
          const pdfjs = await import('pdfjs-dist');
          const arrayBuffer = e.target?.result as ArrayBuffer;
          
          if (!arrayBuffer) {
            resolve('Error: Tidak dapat membaca file PDF');
            return;
          }

          pdf = await pdfjs.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
          }).promise;
          
          let text = '';
          const maxPages = Math.min(pdf.numPages, 10); // Limit to 10 pages to prevent memory issues
          
          for (let i = 1; i <= maxPages; i++) {
            try {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => ('str' in item ? item.str : ''))
                .join(' ');
        text += `\n--- Page ${i} ---\n${pageText}\n`;
              
              // Clean up page resources
              page.cleanup();
            } catch (pageError) {
              console.error(`Error processing page ${i}:`, pageError);
        pushLog(`Error processing page ${i} of ${file.name}: ${String(pageError)}`);
        text += `\n--- Page ${i} ---\n[Error reading page]\n`;
            }
          }

          if (pdf.numPages > 10) {
            text += `\n[Note: Only first 10 pages processed out of ${pdf.numPages} total pages]`;
          }
      pushLog(`PDF processed: ${file.name} pages=${pdf.numPages}`);
      resolve(text || 'Tidak ada teks yang dapat diekstrak dari PDF ini.');
        } catch (error) {
          console.error('Error processing PDF:', error);
      pushLog(`Error processing PDF ${file.name}: ${String(error)}`);
      resolve(`Error: Tidak dapat memproses file PDF "${file.name}". File mungkin rusak atau terenkripsi.`);
        } finally {
          // Always cleanup PDF resources
          if (pdf) {
            try {
              pdf.destroy();
            } catch (cleanupError) {
              console.warn('Error cleaning up PDF resources:', cleanupError);
            }
          }
          // Remove reader from tracking
          fileReadersRef.current = fileReadersRef.current.filter(r => r !== reader);
        }
      };
      reader.onerror = () => {
  fileReadersRef.current = fileReadersRef.current.filter(r => r !== reader);
  pushLog(`FileReader error reading PDF ${file.name}`);
  resolve(`Error: Tidak dapat membaca file "${file.name}"`);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
  pushLog(`onDrop invoked acceptedFiles=${acceptedFiles.length}`);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
    const SUPPORTED_PDF_TYPE = 'application/pdf';

  // Validate files
    const validFiles = acceptedFiles.filter(file => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" terlalu besar. Maksimal size: 10MB`);
        return false;
      }

      // Check file type
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type) && file.type !== SUPPORTED_PDF_TYPE) {
        alert(`File type "${file.type}" tidak didukung. Hanya mendukung gambar (PNG, JPG, JPEG, GIF, WEBP) dan PDF.`);
        return false;
      }

      return true;
    });

  pushLog(`onDrop validation result validFiles=${validFiles.length}`);

    if (validFiles.length === 0) {
      pushLog('No valid files to process after drop');
      return;
    }

    const newAttachments: FileAttachment[] = [];
    setIsLoading(true); // Show loading during file processing
    
    // Process files sequentially to prevent memory issues
  for (const file of validFiles) {
      try {
    pushLog(`Processing dropped file: ${file.name} (${file.type}) size=${file.size}`);
        const blobUrl = URL.createObjectURL(file);
        // Track blob URL for cleanup
        setBlobUrls(prev => [...prev, blobUrl]);
        
        const attachment: FileAttachment = {
          id: Date.now().toString() + Math.random().toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: blobUrl,
        };

        // Process file content based on type
        if (file.type.startsWith('image/')) {
          try {
            attachment.content = await processImage(file);
          } catch (error) {
            console.error(`Error processing image ${file.name}:`, error);
            pushLog(`Error processing image ${file.name}: ${String(error)}`);
            attachment.content = `Error: ${error instanceof Error ? error.message : 'Tidak dapat memproses gambar'}`;
          }
        } else if (file.type === 'application/pdf') {
          attachment.content = await processPDF(file);
        }

        // Only add attachment if component is still mounted
        if (isMountedRef.current) {
          newAttachments.push(attachment);
        } else {
          // Cleanup if component unmounted during processing
          URL.revokeObjectURL(blobUrl);
          setBlobUrls(prev => prev.filter(url => url !== blobUrl));
        }
      } catch (processError) {
        console.error(`Error processing file ${file.name}:`, processError);
        pushLog(`Error processing file ${file.name}: ${String(processError)}`);
        // Continue with other files even if one fails
        const blobUrl = URL.createObjectURL(file);
        setBlobUrls(prev => [...prev, blobUrl]);
        
  const errorAttachment: FileAttachment = {
          id: Date.now().toString() + Math.random().toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: blobUrl,
          content: `Error: Tidak dapat memproses file "${file.name}"`
        };
        
        if (isMountedRef.current) {
          newAttachments.push(errorAttachment);
        } else {
          URL.revokeObjectURL(blobUrl);
          setBlobUrls(prev => prev.filter(url => url !== blobUrl));
        }
      }
    }
    
    setIsLoading(false);
    if (isMountedRef.current) {
      setAttachments(prev => {
        const merged = [...prev, ...newAttachments];
        pushLog(`attachments added from onDrop: count=${newAttachments.length} names=${newAttachments.map(a=>a.name).join(',')}`);
        return merged;
      });
    }
  }, [processImage, processPDF]);

  // Log when attachments or loading state changes for debugging
  useEffect(() => {
    pushLog(`attachments state changed: count=${attachments.length} isLoading=${isLoading}` + (attachments.length ? ` names=${attachments.map(a=>a.name).join(',')}` : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.length, isLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(att => att.id === id);
      if (attachment && attachment.url) {
        // Revoke blob URL to free memory
        URL.revokeObjectURL(attachment.url);
        // Remove from tracked URLs
        setBlobUrls(prevUrls => prevUrls.filter(url => url !== attachment.url));
      }
      return prev.filter(att => att.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    pushLog(`handleSubmit invoked inputLen=${input.length} attachments=${attachments.length} isLoading=${isLoading}`);
    if ((!input.trim() && attachments.length === 0) || isLoading) {
      pushLog('handleSubmit early return: no input and no attachments OR still loading');
      return;
    }

    // Check for API errors first
    if (apiError) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: apiError,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

  // Capture current input and attachments before we clear them from UI
  const capturedInput = input;
  const currentAttachments = [...attachments];

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: capturedInput,
      timestamp: new Date(),
      attachments: currentAttachments,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Clear attachments and their blob URLs from UI but keep a captured copy for processing
  setAttachments([]);
  pushLog(`UI attachments cleared, capturedAttachments=${currentAttachments.length}`);
    currentAttachments.forEach(att => {
      if (att.url) {
        URL.revokeObjectURL(att.url);
      }
    });
    setBlobUrls([]);

  setIsLoading(true);
  setProcessingAttachments(currentAttachments.length > 0);
  pushLog('handleSubmit started; captured attachments=' + currentAttachments.length);

    // Failsafe: Always turn off loading after maximum time
    const failsafeTimeout = setTimeout(() => {
      console.warn('Failsafe timeout triggered - forcing loading to false');
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }, 60000); // 60 seconds failsafe

    try {
      let prompt = capturedInput;
      // Prepare attachments for API (only send type, content, name)
      const apiAttachments = currentAttachments.map(att => ({
        type: att.type,
        content: att.content,
        name: att.name,
      }));

      pushLog(`Sending ${apiAttachments.length} attachments to /api/generate`);

      let res: Response;
      try {
        // Watchdog: warn if fetch doesn't complete quickly (silent network blockage)
        const fetchWatch = setTimeout(() => {
          pushLog('Warning: fetch to /api/generate taking >5s');
        }, 5000);

        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, attachments: apiAttachments }),
        });
        clearTimeout(fetchWatch);
      } catch (fetchErr) {
        pushLog('Fetch to /api/generate failed: ' + String(fetchErr));
        setProcessingError(String(fetchErr));
        throw fetchErr;
      }

      pushLog('Received response from /api/generate status=' + res.status);

      const data = await res.json().catch((err) => {
        pushLog('Failed to parse JSON from /api/generate: ' + String(err));
        throw err;
      });

      if (data && data.text) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        pushLog('No text in response from /api/generate, full response: ' + JSON.stringify(data));
        throw new Error(data?.error || 'No response from server');
      }
    } catch (error: unknown) {
      console.error('Error generating response:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        attachmentsCount: attachments.length,
        inputLength: input.length
      });
      
      let errorText = 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.';
      
      // More specific error messages
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('API_KEY') || errorMsg.includes('invalid key')) {
        errorText = 'Error: API Key tidak valid. Silakan periksa konfigurasi NEXT_PUBLIC_GEMINI_API_KEY.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
        errorText = 'Error: Quota API telah habis atau rate limit terlampaui. Silakan coba lagi dalam beberapa menit.';
      } else if (errorMsg.includes('SAFETY') || errorMsg.includes('safety')) {
        errorText = 'Maaf, konten yang Anda kirim tidak dapat diproses karena alasan keamanan. Silakan coba dengan konten yang berbeda.';
      } else if (errorMsg.includes('model') || errorMsg.includes('MODEL')) {
        errorText = 'Error: Model AI tidak tersedia. Silakan coba lagi nanti.';
      } else if (errorMsg.includes('Image processing error')) {
        errorText = errorMsg; // Use specific image processing error
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        errorText = 'Error: Masalah koneksi internet. Silakan periksa koneksi Anda dan coba lagi.';
      } else if (errorMsg.includes('timeout')) {
        errorText = 'Error: Request timeout. Server membutuhkan waktu terlalu lama untuk merespons.';
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      pushLog('handleSubmit error: ' + errorText);
    } finally {
      clearTimeout(failsafeTimeout);
      console.log('Finally block executed, setting isLoading to false');
      setIsLoading(false);
      setProcessingAttachments(false);
      // Clean up attachment URLs
      currentAttachments.forEach(att => {
        try {
          if (att.url) URL.revokeObjectURL(att.url);
        } catch (error) {
          console.warn('Error revoking blob URL:', error);
        }
      });
      pushLog('handleSubmit finished');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const fakeEvent = new Event('submit') as unknown as React.FormEvent<HTMLFormElement>;
      handleSubmit(fakeEvent);
    }
  };

  // Helper function with timeout
  const withTimeout = (promise: Promise<any>, timeoutMs: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };

  // Retry mechanism for API calls
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
    console.log('Starting retry mechanism with maxRetries:', maxRetries);
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Retry attempt ${i + 1}/${maxRetries}`);
        // Add timeout to each API call (30 seconds)
        const result = await withTimeout(fn(), 30000);
        console.log('API call successful on attempt:', i + 1);
        return result;
      } catch (error) {
        console.error(`Attempt ${i + 1}/${maxRetries} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if it's a rate limit error
        if ((errorMessage.includes('rate limit') || errorMessage.includes('quota')) && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
          console.log(`Rate limited, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        if (i === maxRetries - 1) {
          console.error('All retry attempts failed, throwing error');
          throw error;
        }
      }
    }
  };

  return (
    <>
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-600 text-white">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-semibold">Devy AI Assistent</h1>
            <p className="text-blue-100 text-sm">Powered by Deliver AI</p>
          </div>
        </div>
  {/* Test API button removed for production */}
      </div>

      {/* API Error Display */}
      {apiError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-blue-400" />
              <h2 className="text-2xl font-semibold mb-2">Halo! Saya Devy</h2>
              <p className="text-lg">Apa yang bisa saya bantu hari ini?</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[70%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white ml-auto'
                    : 'bg-gray-50 text-black dark:text-black'
                }`}
              >
                {message.role === 'user' ? (
                  <div>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2">
                        {message.attachments.map((attachment) => (
                          <div key={attachment.id} className="mb-2">
                            {attachment.type.startsWith('image/') ? (
                              <div className="bg-white/20 rounded p-2 mb-2">
                                <div className="relative max-w-full h-48 mb-1">
                                  <Image
                                    src={attachment.url}
                                    alt={attachment.name}
                                    fill
                                    className="rounded object-contain"
                                    sizes="(max-width: 768px) 100vw, 70vw"
                                  />
                                </div>
                                <p className="text-xs opacity-75">{attachment.name}</p>
                              </div>
                            ) : (
                              <div className="bg-white/20 rounded p-2 mb-2 flex items-center space-x-2">
                                <FileText className="w-4 h-4" />
                                <span className="text-xs">{attachment.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 text-black dark:text-black">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <p className="text-xs text-black dark:text-black mt-1">
                {processingAttachments ? 'Memproses file dan menganalisis...' : 'AI sedang berpikir...'}
              </p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {/* File attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative bg-gray-100 rounded-lg p-2 flex items-center space-x-2 max-w-xs"
              >
                {attachment.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                ) : (
                  <FileText className="w-4 h-4 text-red-500" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block text-black dark:text-black">{attachment.name}</span>
                  <span className="text-xs text-black dark:text-black">
                    {(attachment.size / 1024).toFixed(1)}KB
                    {attachment.content?.startsWith('Error:') && (
                      <span className="text-red-500 ml-1">⚠️ Error</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="text-gray-500 hover:text-red-500 transition-colors flex-shrink-0"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drag and drop area */}
        {isDragActive && (
          <div className="mb-3">
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-blue-400 bg-blue-50 rounded-lg p-6 text-center"
            >
              <input {...getInputProps()} />
              <Paperclip className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-blue-600">Lepaskan file di sini...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ketik pesan Anda di sini..."
              className="w-full min-h-[44px] max-h-32 px-4 py-3 pr-12 border border-gray-300 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black dark:text-black placeholder-gray-500"
              disabled={isLoading}
              rows={1}
            />
          </div>
          
          {/* File upload button */}
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            <button
              type="button"
              className="flex-shrink-0 w-11 h-11 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              disabled={isLoading}
            >
              <Paperclip className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            onClick={() => pushLog(`Submit button clicked inputLen=${input.length} attachments=${attachments.length} isLoading=${isLoading}`)}
            className="flex-shrink-0 w-11 h-11 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>

        {/* Upload instructions */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          Drag & drop file atau klik 📎 untuk upload gambar (PNG, JPG) atau PDF (max 10MB)
          {!pdfJsLoaded && (
            <div className="text-orange-500 mt-1">
              ⚠️ PDF processor masih loading...
            </div>
          )}
        </div>
      </div>
    </div>

  {/* Debug UI removed from production build (logs still kept in state) */}
    </>
  );
}
