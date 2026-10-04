import { useEffect, useRef, useState } from 'react';

const getSpeechRecognition = (): SpeechRecognitionConstructor | null =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

interface Options {
  onFinal: (transcript: string) => void;
  onStart: () => void;
}

export function useDictation({ onFinal, onStart }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(onFinal);
  const isSupported = Boolean(getSpeechRecognition());

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
  }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterim('');
  };

  const toggle = () => {
    if (!isSupported) {
      setError('Браузер не поддерживает надиктовку');
      return;
    }
    if (isListening) {
      stop();
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    setError(null);
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = '';
      let finalTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const part = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalTranscript += part;
        } else {
          interimText += part;
        }
      }

      setInterim(interimText);
      if (finalTranscript) {
        onFinalRef.current(finalTranscript);
        setInterim('');
      }
    };

    recognition.onerror = () => {
      setError('Не удалось распознать речь');
      stop();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    onStart();
  };

  return { isSupported, isListening, interim, error, setError, setInterim, toggle, stop };
}
