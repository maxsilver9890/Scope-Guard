"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { isSourceTextAnalyzable, resolveTranscriptHandoff, transcribeAndPrepareHandoff, type TranscriptChoice } from "@/lib/source-text";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_RECORDING_MS = 15 * 60 * 1000;
const RECORDING_BITRATE = 32_000;

type InputMode = "paste" | "record" | "upload";
type Props = {
  input: string;
  onInputChange: (value: string) => void;
  onAnalyze: () => void;
  analysisError: string | null;
  isAnalyzing: boolean;
  isResolving: boolean;
  statusDot: string;
  sourceStatus: string;
};

const MODES: { id: InputMode; label: string }[] = [
  { id: "paste", label: "Paste Text" },
  { id: "record", label: "Record Conversation" },
  { id: "upload", label: "Upload Recording" },
];

const MODE_DESCRIPTIONS: Record<InputMode, string> = {
  paste: "Paste a discovery-call transcript, client brief, or project requirements. You can edit the text before analyzing.",
  record: "Record a conversation and transcribe it into the source text below. Review and edit the transcript before analyzing.",
  upload: "Upload an audio recording to transcribe it into the source text below. Review and edit the transcript before analyzing.",
};

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function extensionForType(type: string): string {
  return type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
}

function AnalyzeArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none">
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ScopeInput({
  input,
  onInputChange,
  onAnalyze,
  analysisError,
  isAnalyzing,
  isResolving,
  statusDot,
  sourceStatus,
}: Props) {
  const [mode, setMode] = useState<InputMode>("paste");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [transcriptionCancelled, setTranscriptionCancelled] = useState(false);
  const [lastTranscribedFile, setLastTranscribedFile] = useState<File | null>(null);
  const inputRef = useRef(input);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopActionRef = useRef<"transcribe" | "cancel">("cancel");
  const inFlightRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  function updateInputText(value: string) {
    inputRef.current = value;
    onInputChange(value);
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
    setRecordingStartedAt(null);
  }

  useEffect(() => {
    if (!isRecording || recordingStartedAt === null) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - recordingStartedAt;
      setElapsedSeconds(Math.min(Math.floor(elapsed / 1000), MAX_RECORDING_MS / 1000));
      if (elapsed >= MAX_RECORDING_MS && recorderRef.current?.state === "recording") {
        setTranscriptionNotice("The 15-minute recording limit was reached. Transcribing the recording now.");
        stopActionRef.current = "transcribe";
        recorderRef.current.stop();
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [isRecording, recordingStartedAt]);

  useEffect(() => () => {
    stopActionRef.current = "cancel";
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (pendingTranscript === null) return;
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingTranscript(null);
        setTranscriptionNotice("Transcript not applied. Your existing source text is unchanged.");
      }
    };
    document.addEventListener("keydown", dismissOnEscape);
    return () => document.removeEventListener("keydown", dismissOnEscape);
  }, [pendingTranscript]);

  async function transcribe(file: File) {
    if (inFlightRef.current) return;
    if (file.size > MAX_AUDIO_BYTES) {
      setTranscriptionError("This recording is over the 4 MiB upload limit. Choose a smaller file or make a shorter recording.");
      setTranscriptionNotice(null);
      return;
    }

    inFlightRef.current = true;
    setIsTranscribing(true);
    setLastTranscribedFile(file);
    setPendingTranscript(null);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    setTranscriptionCancelled(false);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60_000);

    try {
      const handoff = await transcribeAndPrepareHandoff(() => inputRef.current, async () => {
        const form = new FormData();
        form.append("file", file, file.name);
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Transcription failed. Check the audio and retry.";
          throw new Error(message);
        }
        if (typeof payload !== "object" || payload === null || !("text" in payload) || typeof payload.text !== "string" || !payload.text.trim()) {
          throw new Error("The transcription response did not include any text. Retry or choose a clearer recording.");
        }
        return payload.text;
      });
      if (handoff.kind === "error") throw handoff.error;
      if (handoff.kind === "choose") {
        setPendingTranscript(handoff.transcript);
        return;
      }
      if (handoff.kind === "apply") {
        updateInputText(handoff.sourceText);
        setTranscriptionNotice("Transcript ready. Review or edit it below, then choose Analyze.");
      } else if (handoff.kind === "preserve") {
        setTranscriptionError("The transcription did not include any text. Retry or choose a clearer recording.");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setTranscriptionCancelled(true);
        setTranscriptionNotice("Transcription cancelled. Your current text and scope results are unchanged.");
      } else if (error instanceof TypeError) {
        setTranscriptionError("Could not reach Scope Guard. Check your connection and retry.");
      } else {
        setTranscriptionError(error instanceof Error ? error.message : "Transcription failed. Retry the recording.");
      }
    } finally {
      window.clearTimeout(timeout);
      inFlightRef.current = false;
      setIsTranscribing(false);
      requestRef.current = null;
    }
  }

  function chooseTranscript(choice: TranscriptChoice) {
    if (pendingTranscript === null) return;
    const handoff = resolveTranscriptHandoff(inputRef.current, pendingTranscript, choice);
    if (handoff.kind === "apply") {
      updateInputText(handoff.sourceText);
      setTranscriptionNotice("Transcript ready. Review or edit it below, then choose Analyze.");
    } else if (handoff.kind === "preserve") {
      setTranscriptionNotice("Transcript not applied. Your existing source text is unchanged.");
    }
    setPendingTranscript(null);
  }

  async function startRecording() {
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    setRecordingFile(null);
    setTranscriptionCancelled(false);
    if (!window.isSecureContext) {
      setTranscriptionError("Microphone recording requires a secure HTTPS connection.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setTranscriptionError("This browser does not support microphone recording. Use Upload Recording or Paste Text.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = name === "NotAllowedError" || name === "SecurityError"
        ? "Microphone permission was denied. Allow microphone access in your browser settings and try again."
        : name === "NotFoundError"
          ? "No microphone was found. Connect a microphone or use Upload Recording."
          : name === "NotReadableError"
            ? "The microphone is busy or unavailable. Close other apps using it and retry."
            : "Could not start the microphone. Check browser permissions and retry.";
      setTranscriptionError(message);
      return;
    }

    const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    const mimeType = preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      setTranscriptionError("This browser cannot record an audio format accepted by Scope Guard. Use Upload Recording or Paste Text.");
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: RECORDING_BITRATE });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setTranscriptionError("The browser could not create an audio recording. Try another browser or upload a recording.");
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    stopActionRef.current = "cancel";
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      chunksRef.current = [];
      stopTracks();
      setTranscriptionError("Recording was interrupted. Check your microphone and try again.");
    };
    recorder.onstop = () => {
      const action = stopActionRef.current;
      const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
      chunksRef.current = [];
      stopTracks();
      if (action !== "transcribe" || audioBlob.size === 0) return;
      const file = new File([audioBlob], `scope-guard-recording.${extensionForType(audioBlob.type)}`, { type: audioBlob.type });
      setRecordingFile(file);
      if (file.size > MAX_AUDIO_BYTES) {
        setTranscriptionError("This recording exceeded the 4 MiB upload limit. Your existing text and scope results are unchanged. Try a shorter recording or a smaller microphone bitrate.");
        return;
      }
      void transcribe(file);
    };

    try {
      recorder.start(1000);
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setRecordingStartedAt(startedAtRef.current);
      setIsRecording(true);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setTranscriptionError("Recording could not start. Check browser microphone permissions and retry.");
    }
  }

  function stopRecording(action: "transcribe" | "cancel") {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopActionRef.current = action;
    if (action === "cancel") {
      chunksRef.current = [];
      stopTracks();
      setTranscriptionNotice("Recording cancelled. Your current text and scope results are unchanged.");
    }
    if (recorder.state !== "inactive") recorder.stop();
  }

  function selectMode(nextMode: InputMode) {
    if (isRecording || isTranscribing) return;
    setMode(nextMode);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    setTranscriptionCancelled(false);
    if (file && file.size > MAX_AUDIO_BYTES) {
      setTranscriptionError("Choose an audio file that is 4 MiB or smaller.");
    }
    if (file && !/\.(aac|flac|m4a|mp3|mp4|oga|ogg|wav|webm)$/i.test(file.name)) {
      setTranscriptionError("Unsupported file type. Use MP3, M4A/MP4, WAV, WebM, OGG, FLAC, or AAC.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSourceTextAnalyzable(input)) return;
    onAnalyze();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!isSourceTextAnalyzable(input)) return;
      onAnalyze();
    }
  }

  const canAnalyze = isSourceTextAnalyzable(input);
  const unsupportedRecordingBrowser = typeof window !== "undefined" &&
    (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined");

  return (
    <form onSubmit={handleSubmit} className="px-5 pb-5 pt-5 sm:px-6">
      <div className="grid grid-cols-1 gap-1 rounded-xl border border-line/70 bg-slate-50/70 p-1 sm:grid-cols-3" role="tablist" aria-label="Source input method">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            disabled={isRecording || isTranscribing}
            onClick={() => selectMode(item.id)}
            className={`min-h-9 rounded-lg px-2 py-2 text-[10px] font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${mode === item.id ? "bg-white text-forest shadow-sm" : "text-muted hover:bg-white/70 hover:text-forest"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-muted" aria-live="polite">
        {MODE_DESCRIPTIONS[mode]}
      </p>

      {mode === "record" ? (
        <section className="mt-4 rounded-xl border border-line/70 bg-white/75 p-4" aria-labelledby="record-title">
          <h3 id="record-title" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-forest">Record a conversation</h3>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">Recording stays in this browser until you choose transcription. Maximum 15 minutes and 4 MiB.</p>
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[10.5px] leading-5 text-amber-900">Before recording, make sure everyone in the conversation knows it is being recorded and agrees.</p>
          {unsupportedRecordingBrowser ? (
            <p className="mt-3 text-[11px] leading-5 text-muted">Microphone recording needs a supported browser on HTTPS. Upload a recording or paste text instead.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {isRecording ? (
              <>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-rose-700" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />Recording · {formatDuration(elapsedSeconds)}</span>
                <button type="button" onClick={() => stopRecording("transcribe")} className="rounded-lg bg-accent px-3 py-2 text-[11px] font-semibold text-white hover:bg-accent-strong">Stop & transcribe</button>
                <button type="button" onClick={() => stopRecording("cancel")} className="rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-forest hover:bg-slate-50">Cancel</button>
              </>
            ) : (
              <button type="button" disabled={unsupportedRecordingBrowser || isTranscribing || isAnalyzing || isResolving} onClick={() => void startRecording()} className="rounded-lg bg-accent px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50">Start recording</button>
            )}
          </div>
          {recordingFile ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-muted">
              <span>{recordingFile.name} · {(recordingFile.size / (1024 * 1024)).toFixed(2)} MiB</span>
              {recordingFile.size <= MAX_AUDIO_BYTES ? <button type="button" disabled={isTranscribing} onClick={() => void transcribe(recordingFile)} className="font-semibold text-accent underline disabled:opacity-50">Retry transcription</button> : null}
              <button type="button" onClick={() => {
                const url = URL.createObjectURL(recordingFile);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = recordingFile.name;
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }} className="font-semibold text-accent underline">Download recording</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === "upload" ? (
        <section className="mt-4 rounded-xl border border-line/70 bg-white/75 p-4" aria-labelledby="upload-title">
          <h3 id="upload-title" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-forest">Upload a recording</h3>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">MP3, M4A/MP4, WAV, WebM, OGG, FLAC, or AAC · up to 4 MiB.</p>
          <input type="file" accept=".aac,.flac,.m4a,.mp3,.mp4,.oga,.ogg,.wav,.webm,audio/aac,audio/flac,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm" onChange={handleFileChange} disabled={isTranscribing || isAnalyzing || isResolving} aria-label="Choose an audio recording" className="mt-3 block w-full text-[11px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-forest hover:file:bg-slate-200" />
          {selectedFile ? <p className="mt-2 break-all text-[10.5px] text-muted">Selected: {selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(2)} MiB</p> : null}
          <button type="button" disabled={!selectedFile || selectedFile.size > MAX_AUDIO_BYTES || isTranscribing || isAnalyzing || isResolving} onClick={() => selectedFile && void transcribe(selectedFile)} className="mt-3 rounded-lg border border-line px-3 py-2 text-[11px] font-semibold text-forest hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Transcribe recording</button>
        </section>
      ) : null}

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <label htmlFor="source-input" className="text-[10px] font-medium uppercase tracking-[0.16em] text-forest/70">FINAL SOURCE MATERIAL / TRANSCRIPT</label>
        <span className="font-mono text-[10px] tabular-nums text-muted/80">{input.length.toLocaleString("en-US")} characters</span>
      </div>
      <textarea
        id="source-input"
        name="source"
        value={input}
        onChange={(event) => updateInputText(event.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={pendingTranscript !== null}
        rows={16}
        spellCheck={false}
        placeholder={mode === "paste" ? "Paste a discovery transcript, meeting notes, or a rough project brief…" : "Transcribe a recording or add written context here…"}
        aria-describedby={`source-helper source-text-helper transcription-privacy${canAnalyze ? "" : " source-empty-message"}`}
        className="mt-2.5 block max-h-[70vh] min-h-[300px] w-full resize-y rounded-md border border-line bg-white px-4 py-3.5 font-sans text-[13px] leading-[1.75] text-ink/90 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-colors duration-200 placeholder:text-muted/60 focus:border-accent/70 focus:ring-4 focus:ring-accent-soft sm:min-h-[380px]"
      />

      <p id="source-helper" className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
        <span>Source brief · {sourceStatus}</span>
      </p>
      <p id="source-text-helper" className="mt-2 text-[11px] leading-5 text-muted">
        This is the text Scope Guard will analyze. You can edit the transcript or add relevant written context before analyzing.
      </p>

      {isTranscribing ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-[11px] text-sky-900" role="status" aria-live="polite">
          <span className="inline-flex items-center gap-2"><Spinner />Transcribing recording…</span>
          <button type="button" onClick={() => requestRef.current?.abort()} className="font-semibold underline">Cancel transcription</button>
        </div>
      ) : null}
      {transcriptionError ? <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-3 text-[11px] leading-5 text-rose-800">{transcriptionError}</p> : null}
      {transcriptionNotice ? <p role="status" aria-live="polite" className="mt-3 rounded-md border border-line bg-surface px-3.5 py-3 text-[11px] leading-5 text-muted">{transcriptionNotice}</p> : null}
      {transcriptionCancelled && lastTranscribedFile ? <button type="button" onClick={() => void transcribe(lastTranscribedFile)} className="mt-2 text-[10.5px] font-semibold text-accent underline">Retry transcription</button> : null}
      {analysisError ? <div role="alert" className="mt-3.5 flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12px] leading-5 text-rose-800"><p>{analysisError}</p></div> : null}

      {mode !== "paste" ? <p id="transcription-privacy" className="mt-3 rounded-md bg-slate-50 px-3 py-2.5 text-[10px] leading-5 text-muted">When you transcribe, the audio is sent securely to Scope Guard’s server and forwarded to OpenRouter and its transcription provider. Audio is not stored by Scope Guard after the request. Provider retention may vary. Use recordings only with participants’ knowledge and consent.</p> : <span id="transcription-privacy" className="sr-only">Text is sent to Scope Guard for analysis only when Analyze is selected.</span>}

      {pendingTranscript !== null ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) chooseTranscript("cancel");
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="transcript-choice-title"
            aria-describedby="transcript-choice-description"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
              Transcription complete
            </p>
            <h2 id="transcript-choice-title" className="mt-2 font-serif text-2xl leading-tight text-forest">
              How should we use this transcript?
            </h2>
            <p id="transcript-choice-description" className="mt-3 text-[13px] leading-6 text-muted">
              Replacing discards the existing text in the source field. Appending combines the existing text and transcript for analysis.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => chooseTranscript("cancel")} className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-[11px] font-medium text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                Cancel
              </button>
              <button type="button" onClick={() => chooseTranscript("append")} className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3.5 text-[11px] font-medium text-forest transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                Append transcript
              </button>
              <button type="button" onClick={() => chooseTranscript("replace")} className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-[11px] font-medium text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                Replace existing text
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {!canAnalyze ? (
        <p id="source-empty-message" role="status" aria-live="polite" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-5 text-amber-900">
          Add source text before analyzing. You can paste text, or transcribe a recording into this field.
        </p>
      ) : null}

      <p className="mt-4 text-center text-[10.5px] leading-5 text-muted/80">
        Scope Guard analyzes the text in the source field below.
      </p>

      <button
        type="submit"
        disabled={isAnalyzing || isResolving || isTranscribing || !canAnalyze}
        aria-busy={isAnalyzing}
        className="group mt-5 flex h-12 w-full items-center justify-center gap-2.5 rounded-md bg-accent px-5 text-[13px] font-medium tracking-[0.01em] text-white shadow-[0_1px_2px_rgba(79,70,229,0.3),0_10px_24px_-14px_rgba(79,70,229,0.7)] transition-colors duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:bg-accent/45 disabled:text-white/80"
      >
        {isAnalyzing ? <><Spinner />Analyzing brief…</> : <>Analyze<AnalyzeArrow /></>}
      </button>
      <p className="mt-3 text-center text-[10.5px] leading-5 text-muted/80">One extraction pass · One Scope Guard review</p>
    </form>
  );
}
