import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { X, Check, XCircle } from '@phosphor-icons/react'
import { TrialResult, GameSummary } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'

interface StroopTaskProps {
  onComplete: (results: TrialResult[], summary: GameSummary) => void
  onExit: () => void
}

const COLORS = ['RED', 'GREEN', 'BLUE', 'YELLOW'] as const
type ColorType = typeof COLORS[number]

const COLOR_KEYS: Record<string, ColorType> = { r: 'RED', g: 'GREEN', b: 'BLUE', y: 'YELLOW' }
const COLOR_VALUES: Record<ColorType, string> = {
  RED: 'oklch(0.63 0.26 25)',
  GREEN: 'oklch(0.72 0.20 145)',
  BLUE: 'oklch(0.58 0.20 250)',
  YELLOW: 'oklch(0.85 0.18 95)'
}

const CONGRUENT_TRIALS = 48 // Number of congruent trials
const INCONGRUENT_TRIALS = 48 // Number of incongruent trials
const TOTAL_TRIALS = CONGRUENT_TRIALS + INCONGRUENT_TRIALS // Total: 96 trials
const RESPONSE_TIMEOUT = 3000 // PsyToolkit standard: timeout after 3 seconds
const FIXATION_DURATION = 1000 // Gap between words: 1000ms
const FEEDBACK_DURATION = 400 // Feedback display duration in ms
const PRACTICE_TRIALS = 3 // Number of practice trials

export function StroopTask({ onComplete, onExit }: StroopTaskProps) {
  // Instruction and practice state
  const [gamePhase, setGamePhase] = useState<'instructions' | 'practice' | 'test'>('instructions')
  const [instructionPage, setInstructionPage] = useState(1)
  const [practiceComplete, setPracticeComplete] = useState(false)
  
  // Game state
  const [currentTrial, setCurrentTrial] = useState(0)
  const [stimulus, setStimulus] = useState<{ word: ColorType; color: ColorType } | null>(null)
  const [startTime, setStartTime] = useState(0)
  const [results, setResults] = useState<TrialResult[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'timeout' | null>(null)
  const [showFixation, setShowFixation] = useState(true)
  const [streak, setStreak] = useState(0)
  const [timeoutId, setTimeoutId] = useState<number | null>(null)
  const [trialSequence, setTrialSequence] = useState<Array<'congruent' | 'incongruent'>>([])

  // Generate balanced trial sequence (48 congruent + 48 incongruent, randomized)
  const generateTrialSequence = useCallback(() => {
    const sequence: Array<'congruent' | 'incongruent'> = [
      ...Array(CONGRUENT_TRIALS).fill('congruent'),
      ...Array(INCONGRUENT_TRIALS).fill('incongruent')
    ] as Array<'congruent' | 'incongruent'>
    // Shuffle the sequence
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]]
    }
    return sequence
  }, [])

  const generateStimulus = useCallback((trialType: 'congruent' | 'incongruent'): { word: ColorType; color: ColorType } => {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    if (trialType === 'congruent') {
      return { word: color, color }
    } else {
      // Incongruent: word and color must be different
      let word = COLORS[Math.floor(Math.random() * COLORS.length)]
      while (word === color) {
        word = COLORS[Math.floor(Math.random() * COLORS.length)]
      }
      return { word, color }
    }
  }, [])

  // Handle timeout (PsyToolkit standard: status 3 = timeout)
  const handleTimeout = useCallback((timedOutStimulus: { word: ColorType; color: ColorType }) => {
    const trialResult: TrialResult = {
      stimulus: `${timedOutStimulus.word} (${timedOutStimulus.color})`,
      response: 'TIMEOUT',
      correct: false,
      reactionTime: RESPONSE_TIMEOUT,
      trialType: 'timeout',
      status: 3 // PsyToolkit standard: status 3 = timeout
    }

    setResults(prev => [...prev, trialResult])
    setFeedback('timeout')
    setStreak(0)
    setCurrentTrial(prev => prev + 1)

    setTimeout(() => {
      startNextTrial()
    }, FEEDBACK_DURATION)
  }, [])

  const startNextTrial = useCallback(() => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }

    const maxTrials = gamePhase === 'practice' ? PRACTICE_TRIALS : TOTAL_TRIALS

    if (currentTrial >= maxTrials) {
      if (gamePhase === 'practice') {
        // Practice complete, show transition message
        setPracticeComplete(true)
        return
      }
      
      // Test complete - Calculate detailed results
      const totalCorrect = results.filter(r => r.correct).length
      const totalTimeout = results.filter(r => r.trialType === 'timeout').length
      const avgRT = results
        .filter(r => r.trialType !== 'timeout')
        .reduce((sum, r) => sum + r.reactionTime, 0) / (results.length - totalTimeout)
      
      // Separate congruent and incongruent trials
      const congruentTrials = results.filter(r => r.trialType === 'congruent')
      const incongruentTrials = results.filter(r => r.trialType === 'incongruent')
      
      // Calculate RT for congruent trials (only correct responses)
      const congruentCorrectTrials = congruentTrials.filter(t => t.correct && t.trialType !== 'timeout')
      const congruentRT = congruentCorrectTrials.length > 0 
        ? Math.round(congruentCorrectTrials.reduce((sum, r) => sum + r.reactionTime, 0) / congruentCorrectTrials.length)
        : 0
      
      // Calculate RT for incongruent trials (only correct responses)
      const incongruentCorrectTrials = incongruentTrials.filter(t => t.correct && t.trialType !== 'timeout')
      const incongruentRT = incongruentCorrectTrials.length > 0 
        ? Math.round(incongruentCorrectTrials.reduce((sum, r) => sum + r.reactionTime, 0) / incongruentCorrectTrials.length)
        : 0
      
      // Calculate Stroop Interference Effect: RT(incongruent) - RT(congruent)
      const stroopInterferenceEffect = incongruentRT - congruentRT
      
      // Error counts (number of incorrect responses)
      const congruentErrors = congruentTrials.filter(r => !r.correct).length
      const incongruentErrors = incongruentTrials.filter(r => !r.correct).length
      const totalErrors = TOTAL_TRIALS - totalCorrect

      // Error rates as a percentage of trials in each condition
      const congruentErrorRate = congruentTrials.length > 0
        ? (congruentErrors / congruentTrials.length) * 100
        : 0
      const incongruentErrorRate = incongruentTrials.length > 0
        ? (incongruentErrors / incongruentTrials.length) * 100
        : 0
      // Error Interference: Error%(incongruent) - Error%(congruent)
      const errorInterference = incongruentErrorRate - congruentErrorRate

      // Calculate congruent and incongruent correct counts
      const congruentCorrectCount = congruentTrials.filter(r => r.correct).length
      const incongruentCorrectCount = incongruentTrials.filter(r => r.correct).length
      
      onComplete(results, {
        score: totalCorrect,
        accuracy: (totalCorrect / TOTAL_TRIALS) * 100,
        reactionTime: avgRT,
        errorCount: totalErrors,
        errorRate: (totalErrors / TOTAL_TRIALS) * 100,
        details: {
          congruentRT,
          incongruentRT,
          stroopInterferenceEffect,
          congruentErrors,
          incongruentErrors,
          congruentErrorRate,
          incongruentErrorRate,
          errorInterference,
          totalErrors,
          congruentTrials: congruentTrials.length,
          incongruentTrials: incongruentTrials.length,
          congruentCorrect: congruentCorrectCount,
          incongruentCorrect: incongruentCorrectCount,
          timeoutRate: (totalTimeout / TOTAL_TRIALS) * 100
        }
      })
      return
    }

    setShowFixation(true)
    setFeedback(null)
    setTimeout(() => {
      setShowFixation(false)
      
      // For practice, use random trial type; for test, use sequence
      const trialType = gamePhase === 'practice' 
        ? (Math.random() > 0.5 ? 'congruent' : 'incongruent')
        : trialSequence[currentTrial]
      
      const newStimulus = generateStimulus(trialType)
      setStimulus(newStimulus)
      setStartTime(performance.now())
      
      // Set timeout for response (PsyToolkit standard: status 3 = timeout)
      const id = window.setTimeout(() => {
        handleTimeout(newStimulus)
      }, RESPONSE_TIMEOUT)
      setTimeoutId(id)
    }, FIXATION_DURATION)
  }, [currentTrial, results, generateStimulus, onComplete, timeoutId, gamePhase])

  useEffect(() => {
    if (gamePhase === 'test') {
      // Generate trial sequence for test phase
      setTrialSequence(generateTrialSequence())
      startNextTrial()
    } else if (gamePhase === 'practice') {
      startNextTrial()
    }
  }, [gamePhase, generateTrialSequence])

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!stimulus || showFixation || feedback) return
    if (gamePhase === 'instructions') return

    const key = event.key.toLowerCase()
    if (!(key in COLOR_KEYS)) return

    // Clear timeout on response
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }

    const reactionTime = performance.now() - startTime
    const response = COLOR_KEYS[key]
    const correct = response === stimulus.color
    
    // PsyToolkit standard: Status 1=correct, 2=wrong, 3=timeout
    const status = correct ? 1 : 2

    const trialResult: TrialResult = {
      stimulus: `${stimulus.word} (${stimulus.color})`,
      response,
      correct,
      reactionTime,
      trialType: stimulus.word === stimulus.color ? 'congruent' : 'incongruent',
      status // Add PsyToolkit status code
    }

    // Only save results during actual test, not practice
    if (gamePhase === 'test') {
      setResults(prev => [...prev, trialResult])
    }
    
    setFeedback(correct ? 'correct' : 'incorrect')
    setStreak(prev => correct ? prev + 1 : 0)
    setCurrentTrial(prev => prev + 1)

    setTimeout(() => {
      startNextTrial()
    }, FEEDBACK_DURATION)
  }, [stimulus, showFixation, feedback, startTime, timeoutId, startNextTrial, gamePhase])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Handle button clicks
  const handleButtonClick = useCallback((color: ColorType) => {
    if (!stimulus || showFixation || feedback) return
    if (gamePhase === 'instructions') return

    // Clear timeout on response
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }

    const reactionTime = performance.now() - startTime
    const response = color
    const correct = response === stimulus.color
    
    // PsyToolkit standard: Status 1=correct, 2=wrong, 3=timeout
    const status = correct ? 1 : 2

    const trialResult: TrialResult = {
      stimulus: `${stimulus.word} (${stimulus.color})`,
      response,
      correct,
      reactionTime,
      trialType: stimulus.word === stimulus.color ? 'congruent' : 'incongruent',
      status // Add PsyToolkit status code
    }

    // Only save results during actual test, not practice
    if (gamePhase === 'test') {
      setResults(prev => [...prev, trialResult])
    }
    
    setFeedback(correct ? 'correct' : 'incorrect')
    setStreak(prev => correct ? prev + 1 : 0)
    setCurrentTrial(prev => prev + 1)

    setTimeout(() => {
      startNextTrial()
    }, FEEDBACK_DURATION)
  }, [stimulus, showFixation, feedback, startTime, timeoutId, startNextTrial, gamePhase])

  const stats = useMemo(() => {
    const correct = results.filter(r => r.correct).length
    const total = results.length
    const errors = total - correct
    const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0
    
    return {
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      avgRT: total > 0 ? Math.round(results.reduce((sum, r) => sum + r.reactionTime, 0) / total) : 0,
      errors,
      errorRate
    }
  }, [results])

  // Instructions screen
  if (gamePhase === 'instructions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
        <div className="p-3 sm:p-4 md:p-6 border-b border-border/50 backdrop-blur-sm bg-card/50 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-500">
            Instructions {instructionPage} of 4
          </h2>
          <Button variant="ghost" size="icon" onClick={onExit} className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10">
            <X size={20} className="sm:hidden" />
            <X size={24} className="hidden sm:block" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8">
          <Card className="max-w-3xl w-full p-4 sm:p-6 md:p-8 lg:p-12 bg-card/95 backdrop-blur-sm border border-border sm:border-2">
            <AnimatePresence mode="wait">
              {instructionPage === 1 && (
                <motion.div
                  key="page1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 sm:space-y-5 md:space-y-6"
                >
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    In this experiment, you will see <strong>colored words</strong> on the screen.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    Your task is to respond to the <strong>ink color</strong> of the word, 
                    <strong> NOT</strong> the meaning of the word.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    For example, if you see the word <span style={{ color: COLOR_VALUES.RED }}>GREEN</span> 
                    {' '}printed in red ink, you should press <kbd className="px-2 sm:px-3 py-0.5 sm:py-1 bg-muted rounded font-mono text-xs sm:text-sm">R</kbd> for red.
                  </p>
                </motion.div>
              )}

              {instructionPage === 2 && (
                <motion.div
                  key="page2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 sm:space-y-5 md:space-y-6"
                >
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    Use these keys to respond to the ink color:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 my-4 sm:my-6 md:my-8">
                    {Object.entries(COLOR_KEYS).map(([key, color]) => (
                      <div key={key} className="text-center p-3 sm:p-4 md:p-6 bg-muted/50 rounded-lg">
                        <kbd className="block text-2xl sm:text-3xl md:text-4xl font-mono font-bold mb-2 sm:mb-3" style={{ color: COLOR_VALUES[color] }}>
                          {key.toUpperCase()}
                        </kbd>
                        <span className="text-xs sm:text-sm font-medium">{color}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    Respond as <strong>quickly and accurately</strong> as possible.
                  </p>
                </motion.div>
              )}

              {instructionPage === 3 && (
                <motion.div
                  key="page3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 sm:space-y-5 md:space-y-6"
                >
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    You will complete {TOTAL_TRIALS} trials in total ({CONGRUENT_TRIALS} congruent + {INCONGRUENT_TRIALS} incongruent trials).
                  </p>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    First, you will do <strong>{PRACTICE_TRIALS} practice trials</strong> to get familiar with the task.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    After the practice, the real test will begin.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed font-semibold text-primary">
                    Remember: Respond to the COLOR, not the word!
                  </p>
                </motion.div>
              )}

              {instructionPage === 4 && (
                <motion.div
                  key="page4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 sm:space-y-5 md:space-y-6"
                >
                  <div className="text-center mb-2 sm:mb-3 md:mb-4">
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-100 text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1.5 sm:py-2">
                      🎯 About the Practice Trials
                    </Badge>
                  </div>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    During the <strong>{PRACTICE_TRIALS} practice trials</strong>, you will see:
                  </p>
                  <div className="bg-muted/50 p-3 sm:p-4 md:p-6 rounded-lg space-y-2 sm:space-y-3">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl flex-shrink-0">✓</span>
                      <p className="text-xs sm:text-sm md:text-base">
                        A <strong className="text-green-600">green checkmark</strong> appears when you respond correctly
                      </p>
                    </div>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl text-red-600 flex-shrink-0">✗</span>
                      <p className="text-xs sm:text-sm md:text-base">
                        A <strong className="text-red-600">red X</strong> appears when you respond incorrectly
                      </p>
                    </div>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl flex-shrink-0">🔑</span>
                      <p className="text-xs sm:text-sm md:text-base">
                        The card border changes color to show your response feedback
                      </p>
                    </div>
                  </div>
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                    This feedback will help you understand the task before the actual test begins.
                  </p>
                  <div className="bg-primary/10 p-3 sm:p-4 rounded-lg border-l-4 border-primary">
                    <p className="text-xs sm:text-sm md:text-base font-semibold">
                      👍 Pro Tip: Use the practice to get comfortable with the key positions (R, G, B, Y) so you can respond quickly!
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 sm:gap-0 mt-6 sm:mt-8 md:mt-12">
              {instructionPage > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInstructionPage(p => p - 1)}
                  className="text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 w-full sm:w-auto"
                >
                  ← Previous
                </Button>
              )}
              <div className="flex-1 hidden sm:block" />
              {instructionPage < 4 ? (
                <Button
                  size="sm"
                  onClick={() => setInstructionPage(p => p + 1)}
                  className="text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                >
                  Next →
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setGamePhase('practice')
                    setCurrentTrial(0)
                  }}
                  className="text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                >
                  <span className="hidden sm:inline">Leave instructions and start practice</span>
                  <span className="sm:hidden">Start Practice</span>
                  {' '}→
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Practice complete transition screen
  if (practiceComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-3 sm:p-4 md:p-6"
        onClick={() => {
          setPracticeComplete(false)
          setGamePhase('test')
          setCurrentTrial(0)
          setResults([])
        }}
      >
        <Card className="max-w-2xl w-full p-6 sm:p-8 md:p-10 lg:p-12 bg-yellow-500/10 border-2 sm:border-4 border-yellow-500 cursor-pointer hover:bg-yellow-500/20 transition-all">
          <div className="text-center space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              Now you have completed your {PRACTICE_TRIALS} practice trials.
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground">
              The real test begins now. Concentrate!
            </p>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
              Click anywhere to continue
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const maxTrials = gamePhase === 'practice' ? PRACTICE_TRIALS : TOTAL_TRIALS

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <div className="p-3 sm:p-4 md:p-6 border-b border-border/50 backdrop-blur-sm bg-card/50 flex items-center justify-between gap-2">
        <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            {gamePhase === 'practice' && (
              <Badge className="bg-yellow-500 text-black text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 flex-shrink-0">
                PRACTICE
              </Badge>
            )}
            <Progress value={(currentTrial / maxTrials) * 100} className="h-1.5 sm:h-2 flex-1" />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground min-w-12 sm:min-w-20 text-right flex-shrink-0">
              {Math.min(currentTrial, maxTrials)}/{maxTrials}
            </span>
          </div>
          {gamePhase === 'test' && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3">
              <Badge variant="outline" className="gap-1 sm:gap-2 text-xs">
                <span className="text-xs text-muted-foreground hidden sm:inline">Accuracy</span>
                <span className="text-xs text-muted-foreground sm:hidden">Acc</span>
                <span className="font-bold">{stats.accuracy}%</span>
              </Badge>
              <Badge variant="outline" className="gap-1 sm:gap-2 text-xs">
                <span className="text-xs text-muted-foreground">RT</span>
                <span className="font-bold">{stats.avgRT}ms</span>
              </Badge>
              <Badge variant="outline" className="gap-1 sm:gap-2 text-xs">
                <span className="text-xs text-muted-foreground hidden sm:inline">Errors</span>
                <span className="text-xs text-muted-foreground sm:hidden">Err</span>
                <span className="font-bold text-destructive">{stats.errors}</span>
              </Badge>
              {streak >= 3 && (
                <Badge className="gap-1 bg-gradient-to-r from-primary to-accent animate-pulse text-xs">
                  🔥 {streak}
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onExit} className="ml-2 h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0">
          <X size={18} className="sm:hidden" />
          <X size={20} className="hidden sm:block md:hidden" />
          <X size={24} className="hidden md:block" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-3 sm:p-4">
        <AnimatePresence mode="wait">
          {showFixation ? (
            <motion.div
              key="fixation"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-muted-foreground"
            >
              +
            </motion.div>
          ) : stimulus ? (
            <motion.div
              key={`stimulus-${currentTrial}`}
              initial={{ scale: 0.8, opacity: 0, rotateX: -90 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotateX: 90 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl"
            >
              <Card className={`relative p-6 sm:p-10 md:p-12 lg:p-16 border-2 shadow-2xl transition-all duration-200 ${
                feedback === 'correct' 
                  ? 'border-success bg-success/5 shadow-success/20' 
                  : feedback === 'incorrect'
                  ? 'border-destructive bg-destructive/5 shadow-destructive/20'
                  : feedback === 'timeout'
                  ? 'border-orange-500 bg-orange-500/5 shadow-orange-500/20'
                  : 'border-border/50 bg-card/80 backdrop-blur-sm'
              }`}>
                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`absolute -top-3 -right-3 sm:-top-4 sm:-right-4 md:-top-6 md:-right-6 p-2 sm:p-2.5 md:p-3 rounded-full ${
                        feedback === 'correct' ? 'bg-success' : feedback === 'timeout' ? 'bg-orange-500' : 'bg-destructive'
                      }`}
                    >
                      {feedback === 'correct' ? (
                        <>
                          <Check size={20} className="sm:hidden text-white" weight="bold" />
                          <Check size={24} className="hidden sm:block md:hidden text-white" weight="bold" />
                          <Check size={32} className="hidden md:block text-white" weight="bold" />
                        </>
                      ) : feedback === 'timeout' ? (
                        <span className="text-white text-lg sm:text-xl md:text-2xl font-bold">⏱</span>
                      ) : (
                        <>
                          <XCircle size={20} className="sm:hidden text-white" weight="bold" />
                          <XCircle size={24} className="hidden sm:block md:hidden text-white" weight="bold" />
                          <XCircle size={32} className="hidden md:block text-white" weight="bold" />
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-center tracking-tight select-none break-words"
                  style={{ color: COLOR_VALUES[stimulus.color] }}
                >
                  {stimulus.word}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="p-3 sm:p-4 md:p-6 border-t border-border/50 backdrop-blur-sm bg-card/50">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 px-2">
            Press the key for the <strong>ink color</strong>, not the word <span className="hidden sm:inline">(or click the buttons below)</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3">
            {Object.entries(COLOR_KEYS).map(([key, color]) => (
              <motion.div
                key={key}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="text-center"
              >
                <button
                  onClick={() => handleButtonClick(color)}
                  disabled={!stimulus || showFixation || !!feedback}
                  className="w-full p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 active:scale-95"
                >
                  <kbd className="block text-lg sm:text-xl md:text-2xl font-mono font-bold mb-1 sm:mb-1.5 md:mb-2 pointer-events-none text-white">
                    {key.toUpperCase()}
                  </kbd>
                  <span className="text-[10px] sm:text-xs text-white font-medium pointer-events-none">{color}</span>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
