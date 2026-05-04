import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { formatSize } from '@/lib/utils';
import { useTitle } from '@/lib/useTitle';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Paperclip, X } from 'lucide-react';
import { createOutreach, finalizeOutreach, getTopicByUrlSuffix, uploadAttachment } from '@/lib/api';
import type { Question } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Nav } from '@/components/Nav';
import { StepTransition } from '@/components/StepTransition';
import { ProgressBar } from '@/components/ProgressBar';
import { DashboardOrSignupButton } from '@/components/DashboardOrSignupButton';
import TopicClosed from '@/pages/TopicClosed';
import { cn } from '@/lib/utils';


const MAX_BYTES = 10 * 1024 * 1024;

// Steps: 0 = About, 1..N = questions, N+1 = Attachments, N+2 = Done
function totalSteps(questions: Question[]) {
  return questions.length + 2; // About + questions + Attachments (Done is not a real step)
}

export default function CreateOutreach() {
  const { urlSuffix } = useParams<{ urlSuffix: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['topic', urlSuffix],
    queryFn: () => getTopicByUrlSuffix(urlSuffix!),
    enabled: !!urlSuffix,
  });

  const topic = data?.topic;
  const questions = data?.questions ?? [];

  useTitle(topic ? `Contact ${topic.owner_first_name} ${topic.owner_last_name}` : '');

  // Form state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Focus the first interactive element when the step changes
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [step]);

  if (isLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (isError || !topic) {
    return <Navigate to="/404" replace />;
  }

  if (topic.closed_at) {
    return <TopicClosed />;
  }

  const numSteps = totalSteps(questions);
  // step 0 = About, 1..N = question[step-1], N+1 = Attachments

  const advance = () => {
    setDirection(1);
    setStep(s => s + 1);
  };

  const back = () => {
    setDirection(-1);
    setStep(s => s - 1);
  };

  const handleEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  const handleNext = () => {
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
      advance();
    } else if (step <= questions.length) {
      // responses can be blank — just advance
      advance();
    } else {
      // Attachments step — submit
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const oversize = selected.find(f => f.size > MAX_BYTES);
    if (oversize) {
      setFileError(`${oversize.name} exceeds the 10 MB limit.`);
      return;
    }
    setFileError('');
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...selected.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { id } = await createOutreach({
        topic_id: topic.id,
        first_name: firstName,
        last_name: lastName,
        email,
        linkedin_url: linkedinUrl,
        responses: Object.fromEntries(
          questions.map(r => [r.id, responses[r.id] ?? '']),
        ),
      });
      for (const file of files) {
        await uploadAttachment(id, file);
      }
      await finalizeOutreach(id);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6 bg-background">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-score-green/10 mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-score-green" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Pitch Submitted</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Thanks for reaching out to <span className="text-foreground font-medium">{topic.owner_first_name} {topic.owner_last_name}</span>.
          </p>
          <DashboardOrSignupButton />
        </div>
      </div>
    );
  }

  // ── Multi-step form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <Nav showButtons={false} titleText={`Contact ${topic.owner_first_name} ${topic.owner_last_name}`} progressBar={<ProgressBar current={step} total={numSteps} />} />

      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <StepTransition stepKey={step} direction={direction}>
            {/* Step 0: About You */}
            {step === 0 && (
              <div className="space-y-5">
                {topic.submission_instructions && (
                  <div className="p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground leading-relaxed">
                    {topic.submission_instructions}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Step 1 of {numSteps}
                  </p>
                  <h2 className="text-2xl font-semibold">About You</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      onKeyDown={handleEnter}
                      placeholder="Jane"
                      autoFocus
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      onKeyDown={handleEnter}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={handleEnter}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkedin_url">
                    LinkedIn URL{' '}
                    <span className="text-muted-foreground font-normal text-xs">— optional, helps qualify your submission</span>
                  </Label>
                  <Input
                    id="linkedin_url"
                    type="url"
                    value={linkedinUrl}
                    onChange={e => setLinkedinUrl(e.target.value)}
                    onKeyDown={handleEnter}
                    placeholder="https://linkedin.com/in/your-profile"
                  />
                </div>
                <StepActions
                  onNext={handleNext}
                  nextDisabled={!firstName.trim() || !lastName.trim() || !email.trim()}
                  step={step}
                  total={numSteps}
                />
              </div>
            )}

            {/* Question steps */}
            {step >= 1 && step <= questions.length && (() => {
              const req = questions[step - 1];
              return (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      Step {step + 1} of {numSteps}
                    </p>
                    <h2 className="text-2xl font-semibold">{req.text}</h2>
                  </div>
                  <Textarea
                    value={responses[req.id] ?? ''}
                    onChange={e => setResponses(r => ({ ...r, [req.id]: e.target.value }))}
                    onKeyDown={handleEnter}
                    placeholder="Your answer…"
                    rows={5}
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  />
                  <p className="text-xs text-muted-foreground">
                    Press <kbd className="px-1 py-0.5 rounded border border-border font-mono text-xs">Shift+Enter</kbd> for a new line,{' '}
                    <kbd className="px-1 py-0.5 rounded border border-border font-mono text-xs">Enter ↵</kbd> to continue
                  </p>
                  <StepActions
                    onBack={back}
                    onNext={handleNext}
                    step={step}
                    total={numSteps}
                  />
                </div>
              );
            })()}

            {/* Attachments step */}
            {step === questions.length + 1 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Step {step + 1} of {numSteps}
                  </p>
                  <h2 className="text-2xl font-semibold">Attachments</h2>
                  <p className="text-muted-foreground text-sm mt-1">Optional. Max 10 MB per file.</p>
                </div>
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.name} className="flex items-center gap-2 text-sm bg-card border border-border rounded-lg px-3 py-2">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground text-xs">{formatSize(f.size)}</span>
                      <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className={cn(
                  'flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline',
                )}>
                  <Paperclip className="w-3.5 h-3.5" />
                  Add file
                  <input type="file" multiple className="sr-only" onChange={handleFileChange} />
                </label>
                {fileError && (
                  <p className="text-sm text-destructive">{fileError}</p>
                )}
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <StepActions
                  onBack={back}
                  onNext={handleNext}
                  nextLabel={submitting ? 'Submitting…' : 'Submit'}
                  nextDisabled={submitting}
                  step={step}
                  total={numSteps}
                />
              </div>
            )}
          </StepTransition>
        </div>
      </div>
    </div>
  );
}

interface StepActionsProps {
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  step: number;
  total: number;
}

function StepActions({ onNext, onBack, nextLabel = 'Continue', nextDisabled, step, total }: StepActionsProps) {
  const isLast = step === total - 1;
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      )}
      <Button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(!isLast && 'px-6', 'btn-glow')}
      >
        {isLast ? nextLabel : nextLabel === 'Continue' ? (
          <>Continue <span className="ml-1 opacity-70 text-xs">↵</span></>
        ) : nextLabel}
      </Button>
    </div>
  );
}
