import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@/lib/useTitle';
import { Nav } from '@/components/Nav';
import { ProgressBar } from '@/components/ProgressBar';
import { StepTransition } from '@/components/StepTransition';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { completeOnboarding, onboardingPrefill } from '@/lib/api';
import { TopicLinkCard } from '@/components/TopicLinkCard';
import { Topic, Question } from '@/lib/onboarding-types';
import { User } from '@/lib/types';
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
import { toast } from 'sonner';

export default function Onboarding() {
  useTitle('Onboarding');

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = queryClient.getQueryData<User>(['me']);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Step 1 — About You
  const [aboutRole, setAboutRole] = useState('');
  const [aboutDescription, setAboutDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Step 2 — Topics
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const topicsLoadedRef = useRef(false);

  // Step 3 — Questions
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  // Step 3 — submit
  const [submitting, setSubmitting] = useState(false);

  // Step 4
  const [createdTopics, setCreatedTopics] = useState<{ name: string; url: string }[]>([]);

  const TOTAL_STEPS = 5;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 0));
  }, []);

  const canAdvanceStep1 = !!(aboutRole || aboutDescription);
  const canAdvanceStep2 = topics.length > 0 && !topics.some(i => !i.name) && !topicsLoading;
  const canAdvanceStep3 =
    topics.length > 0 &&
    topics.every((i: Topic) => i.questions.filter(r => r.text.trim() !== '').length > 0) &&
    !submitting;

  const fallbackTopics: Array<{ name: string; description: string }> = [
    { name: 'Partnership Proposals', description: 'Requests for strategic partnerships or collaborations' },
    { name: 'Sales Pitches', description: 'Vendors or services trying to sell you something' },
    { name: 'Investment Opportunities', description: 'Fundraising asks or investment proposals' },
    { name: 'Consulting & Services', description: 'Offers for professional services or consulting' },
  ];

  useEffect(() => {
    if (step === 2 && !topicsLoadedRef.current && topics.length === 0) {
      topicsLoadedRef.current = true;
      setTopicsLoading(true);
      setTopics(fallbackTopics.map(i => ({
        id: crypto.randomUUID(),
        name: i.name,
        description: i.description,
        questions: [],
      })));
      setTopicsLoading(false);
    }
  }, [step, topics.length]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const result = await onboardingPrefill(aboutRole, aboutDescription);
      setTopics(result.map(i => ({
        id: crypto.randomUUID(),
        name: i.name,
        description: i.description,
        questions: i.questions.map(r => ({ text: r.text, modelAnswer: r.model_answer })),
      })));
      topicsLoadedRef.current = true;
      setAnalyzing(false);
      goNext();
    } catch {
      toast.error('Something went wrong. Please try again.');
      setAnalyzing(false);
    }
  }, [aboutRole, aboutDescription, goNext]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await completeOnboarding(
        topics.map((i: Topic) => ({
          name: i.name,
          description: i.description,
          questions: i.questions.map((r: { text: string; modelAnswer: string }) => ({ text: r.text, model_answer: r.modelAnswer })),
        })),
      );
      setCreatedTopics(result);
      // Do not invalidate the /me cache here so that the success screen can display.
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }, [topics, goNext]);

  const closeOnboarding = () => {
    // Invalidate the cache so "is_onboarded" flag switches.
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['topics'] });
    navigate('/');
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const isTextarea = (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (isTextarea && e.shiftKey) return;
      if (isTextarea) e.preventDefault();

      if (step === 0) goNext();
      else if (step === 1 && canAdvanceStep1) handleAnalyze();
      else if (step === 2 && canAdvanceStep2) goNext();
      else if (step === 3 && canAdvanceStep3) handleSubmit();
      else if (step === 4) closeOnboarding();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, canAdvanceStep1, canAdvanceStep2, canAdvanceStep3, submitting, goNext, handleAnalyze, handleSubmit, navigate]);


  const updateTopic = (id: string, field: 'name' | 'description', value: string) => {
    setTopics(items => items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const deleteTopic = (id: string) => {
    setTopics(items => items.filter(i => i.id !== id));
  };

  const addTopic = () => {
    const id = crypto.randomUUID();
    setTopics(items => [...items, { id, name: '', description: '', questions: [] }]);
    setEditingTopicId(id);
  };

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

  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [editingQuestionKey, setEditingQuestionKey] = useState<string | null>(null);

  const stepTitles = ['Welcome', 'About You', 'Topics', 'Questions', 'Your Link'];

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <Nav
        showButtons={true}
        titleText={`${step + 1} / ${TOTAL_STEPS} · ${stepTitles[step]}`}
        progressBar={<ProgressBar current={step} total={TOTAL_STEPS} />}
      />

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <StepTransition stepKey={step} direction={direction}>
            {step === 0 && (
              <div className="text-center space-y-8">
                <div>
                  <h2 className="text-4xl font-bold gradient-text mb-2 tracking-tight">Welcome to Kredd</h2>
                  <p className="text-sm text-muted-foreground">AI-powered pitch intake — takes ~2 min to set up.</p>
                </div>

                <div className="grid grid-cols-[20px_auto_auto] gap-x-2.5 gap-y-2 text-[13px] text-muted-foreground mx-auto w-fit">
                  {[
                    ['About You', 'Who you are'],
                    ['Topics', 'What pitches you accept'],
                    ['Questions', 'What senders answer'],
                    ['Your link', 'Share & start receiving'],
                  ].map(([label, desc], i) => (
                    <Fragment key={i}>
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="font-medium text-foreground/90 text-left">{label}</span>
                      <span className="text-left"><span className="text-muted-foreground/30 mr-1.5">·</span>{desc}</span>
                    </Fragment>
                  ))}
                </div>

                <div>
                  <Button
                    size="lg"
                    onClick={goNext}
                    className="gap-2 px-10 gradient-bg border-0 text-primary-foreground btn-glow"
                  >
                    Get started
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                  <p className="text-xs text-muted-foreground/40 mt-3">press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter ↵</kbd></p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">Let's get to know you</h2>
                  <p className="text-lg text-muted-foreground">Share as much as you like. We'll use this to auto-fill everything.</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Your role</label>
                    <input
                      value={aboutRole}
                      onChange={e => setAboutRole(e.target.value)}
                      className="w-full border-0 border-b-2 border-input bg-transparent px-0 py-3 text-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:border-primary transition-colors"
                      placeholder="e.g. Head of Partnerships at Acme Corp"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block uppercase tracking-wider">What inbound do you get?</label>
                    <textarea
                      value={aboutDescription}
                      onChange={e => setAboutDescription(e.target.value)}
                      className="w-full border-0 border-b-2 border-input bg-transparent px-0 py-3 text-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:border-primary transition-colors resize-none"
                      placeholder="e.g. I get cold pitches from SaaS vendors, founders asking me to invest, and consultants offering services."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={!canAdvanceStep1 || analyzing}
                    className="w-full gap-2 gradient-bg border-0 text-primary-foreground btn-glow"
                  >
                    {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {analyzing ? 'Analyzing…' : 'Analyze'}
                  </Button>
                </div>
                <div className="flex flex-col gap-3 pt-6">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="lg" onClick={goBack} disabled={analyzing} className="gap-2 -ml-3">
                      <ArrowLeft className="w-5 h-5" /> Back
                    </Button>
                    <Button
                      onClick={goNext}
                      variant="ghost" size="lg"
                      disabled={analyzing}
                      className="gap-2 -ml-3"
                    >
                      Skip — I'll fill in manually
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">What kind of pitches do you get?</h2>
                  <p className="text-lg text-muted-foreground">Suggested topics. Edit freely.</p>
                </div>
                {topicsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="border border-border rounded-xl p-5 space-y-3">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-72" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topics.map(topic => {
                      const isEditing = editingTopicId === topic.id;
                      return (
                        <div key={topic.id} className="border border-border rounded-xl p-5 bg-card hover:shadow-md hover:border-primary/30 transition-all group">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => setEditingTopicId(isEditing ? null : topic.id)}
                              className={`p-1.5 rounded-md transition-colors mt-0.5 shrink-0 ${isEditing ? 'text-primary bg-primary/10' : 'text-muted-foreground/30 hover:text-primary/60'}`}
                              title={isEditing ? 'Done editing' : 'Edit topic'}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <>
                                  <input
                                    value={topic.name}
                                    onChange={e => updateTopic(topic.id, 'name', e.target.value)}
                                    className="w-full font-semibold text-foreground bg-transparent outline-hidden text-lg placeholder:text-muted-foreground/40 border-b border-primary/40 transition-colors"
                                    placeholder="Topic name"
                                    autoFocus
                                  />
                                  <textarea
                                    value={topic.description}
                                    onChange={e => updateTopic(topic.id, 'description', e.target.value)}
                                    className="w-full text-sm text-muted-foreground bg-transparent outline-hidden placeholder:text-muted-foreground/40 border-b border-primary/40 transition-colors mt-2 resize-none"
                                    placeholder="Short description"
                                    rows={2}
                                  />
                                </>
                              ) : (
                                <>
                                  <p className="font-semibold text-foreground text-lg">{topic.name}</p>
                                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{topic.description}</p>
                                </>
                              )}
                            </div>
                            <button onClick={() => deleteTopic(topic.id)} className="p-1.5 text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={addTopic}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-3 w-full justify-center border border-dashed border-border rounded-xl hover:border-primary/30"
                    >
                      <Plus className="w-4 h-4" /> Add topic
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between pt-6">
                  <Button variant="ghost" size="lg" onClick={goBack} className="gap-2">
                    <ArrowLeft className="w-5 h-5" /> Back
                  </Button>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter ↵</kbd></span>
                    <Button
                      size="lg"
                      onClick={goNext}
                      disabled={topics.length === 0 || topics.some(i => !i.name) || topicsLoading}
                      className="gap-2 px-8 gradient-bg border-0 text-primary-foreground btn-glow"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">Review your intake questions</h2>
                  <p className="text-lg text-muted-foreground">These are the questions senders will answer. Add example answers to guide AI scoring.</p>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {topics.map(topic => {
                    return (
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
                            <>
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
                            </>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                      disabled={!canAdvanceStep3}
                      className="gap-2 px-8 gradient-bg border-0 text-primary-foreground btn-glow"
                    >
                      {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</> : 'Submit'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold gradient-text mb-2 tracking-tight">You're all set{user?.first_name ? `, ${user.first_name}` : ''}.</h2>
                  <p className="text-lg text-muted-foreground">Share your links to start receiving pitches.</p>
                </div>
                <div className="space-y-3">
                  {createdTopics.map((i: { name: string; url: string }) => (
                    <TopicLinkCard key={i.url} name={i.name} url={i.url} />
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter ↵</kbd></span>
                    <Button size="lg" onClick={() => closeOnboarding()} className="gap-2 px-8 gradient-bg border-0 text-primary-foreground btn-glow">
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
