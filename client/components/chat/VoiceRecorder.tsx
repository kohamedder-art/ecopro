// Voice Message Recording Component
// Uses MediaRecorder API for audio capture

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Trash2, Loader } from 'lucide-react';

interface VoiceRecorderProps {
  chatId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VoiceRecorder({ chatId, onSuccess, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      streamRef.current = stream;

      // Check supported MIME types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start recording:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access to record voice messages.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to start recording. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    onCancel();
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob) return;

    setIsSending(true);
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      const extension = audioBlob.type.includes('webm') ? 'webm' : 
                       audioBlob.type.includes('ogg') ? 'ogg' : 'mp4';
      formData.append('file', audioBlob, `voice-message.${extension}`);
      formData.append('chat_id', String(chatId));
      formData.append('message_type', 'voice');

      // Upload voice message
      const response = await fetch(`/api/chat/${chatId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send voice message');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to send voice message:', err);
      setError(err.message || 'Failed to send voice message');
    } finally {
      setIsSending(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
      {/* Error Display */}
      {error && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-red-900/80 text-red-200 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Recording State */}
      {!audioBlob ? (
        <>
          {!isRecording ? (
            // Start Recording Button
            <button
              onClick={startRecording}
              className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition shadow-lg"
              title="Start recording"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            // Recording in progress
            <>
              <button
                onClick={stopRecording}
                className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition animate-pulse shadow-lg"
                title="Stop recording"
              >
                <Square className="w-5 h-5" />
              </button>
              
              {/* Recording indicator */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-400 font-mono text-sm">
                  {formatDuration(duration)}
                </span>
              </div>

              {/* Audio Visualizer */}
              <div className="flex-1 flex items-center gap-0.5 h-8">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 100}%`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Cancel Button */}
          <button
            onClick={cancelRecording}
            className="p-2 text-gray-400 hover:text-white transition"
            title="Cancel"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      ) : (
        // Preview recorded audio
        <>
          {/* Audio Preview */}
          <audio src={audioUrl!} controls className="flex-1 h-10" />
          
          {/* Duration */}
          <span className="text-gray-400 text-sm font-mono">
            {formatDuration(duration)}
          </span>

          {/* Send Button */}
          <button
            onClick={sendVoiceMessage}
            disabled={isSending}
            className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-full transition shadow-lg"
            title="Send voice message"
          >
            {isSending ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>

          {/* Re-record Button */}
          <button
            onClick={() => {
              if (audioUrl) URL.revokeObjectURL(audioUrl);
              setAudioBlob(null);
              setAudioUrl(null);
              setDuration(0);
            }}
            className="p-2 text-gray-400 hover:text-white transition"
            title="Re-record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
