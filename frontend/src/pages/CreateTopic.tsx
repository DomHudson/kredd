import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@/lib/useTitle';
import { Nav } from '@/components/Nav';
import { ProgressBar } from '@/components/ProgressBar';
import { StepTransition } from '@/components/StepTransition';
import { Button } from '@/components/ui/button';
import { createTopic, newTopicPrefill } from '@/lib/api';
import { TopicLinkCard } from '@/components/TopicLinkCard';
import { Topic, Question } from '@/lib/onboarding-types';
import { User } from '@/lib/types';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Sparkles,
} from 'lucide-react';

const TOTAL_STEPS = 3;

export default function CreateTopic() {
  useTitle('New Topic');

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = queryClient.getQueryData<User>(['me']);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Step 0 — About Your Topic
  const [aboutDescription, setAboutDescription] = useState('');

  // Step 1 — Questions
  const [topics, setTopics] = useState<Topic[]>([{
    id: crypto.randomUUID(),
    name: 'New Topic',
    description: '',
    questions: [],
  }]);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [editingQuestionKey, setEditingQuestionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Step 2 — Success
  const [createdTopics, setCreatedTopics] = useState<{ name: string; url: string }[]>([]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const result = await newTopicPrefill(aboutDescription);
      setTopics([{
        id: crypto.randomUUID(),
        name: result.name,
        description: '',
        questions: result.questions.map(q => ({ text: q.text, modelAnswer: q.model_answer })),
      }]);
      setDirection(1);
      setStep(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [aboutDescription]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 0));
  }, []);

  const canAdvanceStep0 = aboutDescription.trim().length > 0;

  const canAdvanceStep1 =
    topics.length > 0 &&
    topics.every((i: Topic) => i.questions.filter(r => r.text.trim() !== '').length > 0) &&
    !submitting;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const results = await Promise.all(
        topics.map((topic: Topic) =>
          createTopic(
            topic.name,
            topic.description,
            topic.questions.map((q: Question) => ({ text: q.text, model_answer: q.modelAnswer })),
          ).then(res => ({ name: topic.name, url: res.url }))
        )
      );
      setCreatedTopics(results);
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }, [topics, goNext]);

  const handleClose = () => {
    queryClient.invalidateQueries({ queryKey: ['topics'] });
    navigate('/');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const isTextarea = (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (isTextarea && e.shiftKey) return;
      if (isTextarea) e.preventDefault();

      if (step === 0 && canAdvanceStep0) handleAnalyze();
      else if (step === 1 && canAdvanceStep1) handleSubmit();
      else if (step === 2) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, canAdvanceStep0, canAdvanceStep1, submitting, goNext, handleAnalyze, handleSubmit, navigate]);

  const updateQuestion = (topicId: string, rIdx: number, field: 'text' | 'modelAnswer', value: string) => {
    setTopics(items => items.map(i =>
      i.id === topicId ? { ...i, questions: i.questions.map((r, idx) => idx === rIdx ? { ...r, [field]: value } : r) } : i
    ));
  };

  const deleteQuestion = (topicId: string, rIdx: number) => {
    setTopics(items => items.map(i =>
      i.id === topicId ? { ...i, questions: i.questions.filter((_, idx) => idx !== rIdx) } : i
    ));
  };

  const addQuestion = (topicId: string) => {
    const topic = topics.find(i => i.id === topicId);
    if (!topic) return;
    const newIdx = topic.questions.length;
    setTopics(items => items.map(i =>
      i.id === topicId ? { ...i, questions: [...i.questions, { text: '', modelAnswer: '' }] } : i
    ));
    setEditingQuestionKey(`${topicId}-${newIdx}`);
  };

  const moveQuestion = (topicId: string, from: number, dir: -1 | 1) => {
    setTopics(items => items.map(i => {
      if (i.id !== topicId) return i;
      const to = from + dir;
      if (to < 0 || to >= i.questions.length) return i;
      const reqs = [...i.questions];
      [reqs[from], reqs[to]] = [reqs[to], reqs[from]];
      return { ...i, questions: reqs };
    }));
  };

  const stepTitles = ['About Your Topic', 'Questions', 'Done'];

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <Nav
        showButtons={true}
        titleText={`${step + 1} / ${TOTAL_STEPS} · ${stepTitles[step]}`}
        progressBar={<ProgressBar current={step} total={TOTAL_STEPS} />}
      />

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <StepTransition stepKey={step} direction={direction}>
            {step === 0 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">What kind of outreach does this topic attract?</h2>
                  <p className="text-lg text-muted-foreground">Share as much as you like. We'll use this to auto-fill everything.</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <textarea
                      value={aboutDescription}
                      onChange={e => setAboutDescription(e.target.value)}
                      className="w-full border-0 border-b-2 border-input bg-transparent px-0 py-3 text-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:border-primary transition-colors resize-none"
                      placeholder="e.g. This topic covers press, media enquiries, and interview requests."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={!canAdvanceStep0 || analyzing}
                    className="w-full gap-2 gradient-bg border-0 text-primary-foreground btn-glow"
                  >
                    {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Analyze
                  </Button>
                </div>
                <div className="flex flex-col gap-3 pt-6">
                  <div className="flex items-center justify-end">
                    <Button
                      onClick={goNext}
                      disabled={analyzing}
                      variant="ghost" size="lg"
                      className="gap-2 -ml-3"
                    >
                      Skip — I'll fill in manually
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">Review your intake questions</h2>
                  <p className="text-lg text-muted-foreground">These are the questions senders will answer. Add example answers to guide AI scoring.</p>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {topics.map(topic => (
                    <div key={topic.id} className="border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => {
                          const opening = expandedTopic !== topic.id;
                          setExpandedTopic(opening ? topic.id : null);
                          if (opening && topic.questions.length === 0) {
                            setTopics((items: Topic[]) => items.map((i: Topic) =>
                              i.id === topic.id ? { ...i, questions: [{ text: '', modelAnswer: '' }] } : i
                            ));
                            setEditingQuestionKey(`${topic.id}-0`);
                          }
                        }}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-semibold text-foreground text-base">{topic.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {(() => { const n = topic.questions.filter((r: Question) => r.text.trim() !== '').length; return `${n} ${n === 1 ? 'question' : 'questions'}`; })()}
                        </span>
                      </button>
                      {expandedTopic === topic.id && (
                        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                          {topic.questions.map((req, i) => {
                            const rKey = `${topic.id}-${i}`;
                            const isEditingReq = editingQuestionKey === rKey;
                            return (
                              <div key={i} className="group border border-border/50 rounded-lg p-4 space-y-2 hover:border-border transition-colors">
                                <div className="flex items-start gap-2">
                                  <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                                    <button
                                      onClick={() => moveQuestion(topic.id, i, -1)}
                                      disabled={i === 0}
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => moveQuestion(topic.id, i, 1)}
                                      disabled={i === topic.questions.length - 1}
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {isEditingReq ? (
                                      <textarea
                                        value={req.text}
                                        onChange={e => updateQuestion(topic.id, i, 'text', e.target.value)}
                                        className="w-full text-sm bg-transparent outline-hidden text-foreground placeholder:text-muted-foreground py-1 resize-none border-b border-primary/40"
                                        placeholder="Enter a question"
                                        rows={2}
                                        autoFocus
                                      />
                                    ) : (
                                      <p className="text-sm text-foreground py-1 leading-relaxed">{req.text || <span className="text-muted-foreground italic">Question required</span>}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => setEditingQuestionKey(isEditingReq ? null : rKey)}
                                      className={`p-1.5 rounded-md transition-colors ${isEditingReq ? 'text-primary bg-primary/10' : 'text-muted-foreground/30 hover:text-primary/60'}`}
                                      title={isEditingReq ? 'Done editing' : 'Edit question'}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteQuestion(topic.id, i)}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground/30 hover:text-destructive transition-all"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="pl-7">
                                  <textarea
                                    value={req.modelAnswer}
                                    onChange={e => updateQuestion(topic.id, i, 'modelAnswer', e.target.value)}
                                    className="w-full text-xs bg-muted/50 rounded-md px-3 py-2 text-muted-foreground placeholder:text-muted-foreground/50 border-none outline-hidden resize-none focus:ring-1 focus:ring-primary/20"
                                    placeholder="Example of a good answer (optional — improves AI scoring)"
                                    rows={2}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => addQuestion(topic.id)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors pt-1"
                          >
                            <Plus className="w-3 h-3" /> Add question
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Button variant="ghost" size="lg" onClick={goBack} disabled={submitting} className="gap-2">
                    <ArrowLeft className="w-5 h-5" /> Back
                  </Button>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter ↵</kbd></span>
                    <Button
                      size="lg"
                      onClick={handleSubmit}
                      disabled={!canAdvanceStep1}
                      className="gap-2 px-8 gradient-bg border-0 text-primary-foreground btn-glow"
                    >
                      {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</> : 'Submit'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">You're all set{user?.first_name ? `, ${user.first_name}` : ''}.</h2>
                  <p className="text-lg text-muted-foreground">Share your links to start receiving outreaches.</p>
                </div>
                <div className="space-y-3">
                  {createdTopics.map((i: { name: string; url: string }) => (
                    <TopicLinkCard key={i.url} name={i.name} url={i.url} />
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter ↵</kbd></span>
                    <Button size="lg" onClick={handleClose} className="gap-2 px-8 gradient-bg border-0 text-primary-foreground btn-glow">
                      Go to Dashboard <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </StepTransition>
        </div>
      </div>
    </div>
  );
}