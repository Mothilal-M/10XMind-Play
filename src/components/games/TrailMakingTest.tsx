import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Timer, Lightning, Check } from '@phosphor-icons/react'
import { TrialResult, GameSummary } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'

interface TrailMakingTestProps {
  onComplete: (results: TrialResult[], summary: GameSummary) => void
  onExit: () => void
}

interface Circle {
  id: number
  label: string
  x: number
  y: number
  isClicked: boolean
}

type GamePhase = 'instructions' | 'practice-a' | 'transition-a' | 'test-a' | 'transition-b' | 'practice-b' | 'test-b'

// Base dimensions for circle generation (circles will be scaled based on container)
const BASE_WIDTH = 1000
const BASE_HEIGHT = 600

export function TrailMakingTest({ onComplete, onExit }: TrailMakingTestProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions')
  const [instructionPage, setInstructionPage] = useState(0)
  
  const [testPart, setTestPart] = useState<'A' | 'B'>('A')
  const [circles, setCircles] = useState<Circle[]>([])
  const [currentTarget, setCurrentTarget] = useState(0)
  const [errors, setErrors] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [completionTime, setCompletionTime] = useState(0)
  
  // TMT-A Results
  const [tmtATime, setTmtATime] = useState(0)
  const [tmtAErrors, setTmtAErrors] = useState(0)
  
  // TMT-B Results
  const [tmtBTime, setTmtBTime] = useState(0)
  const [tmtBErrors, setTmtBErrors] = useState(0)
  
  const [isComplete, setIsComplete] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [results, setResults] = useState<TrialResult[]>([])
  
  // Container sizing
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: BASE_WIDTH, height: BASE_HEIGHT })

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const generateCircles = useCallback((partType: 'A' | 'B', isPractice: boolean = false) => {
    const count = isPractice ? 8 : 25
    const newCircles: Circle[] = []
    // Use base dimensions for generation, will be scaled on render
    const containerWidth = BASE_WIDTH
    const containerHeight = BASE_HEIGHT
    const minDistance = 80
    // Account for circle size (max 64px) and padding
    const margin = 80

    if (partType === 'A') {
      // TMT-A: Numbers
      for (let i = 1; i <= count; i++) {
        let x, y, attempts = 0
        do {
          x = Math.random() * (containerWidth - margin * 2) + margin
          y = Math.random() * (containerHeight - margin * 2) + margin
          attempts++
        } while (
          attempts < 100 &&
          newCircles.some(c => Math.hypot(c.x - x, c.y - y) < minDistance)
        )
        newCircles.push({ id: i - 1, label: i.toString(), x, y, isClicked: false })
      }
    } else {
      // TMT-B: Alternate numbers and letters
      const labels: string[] = []
      const maxNum = isPractice ? 4 : 13
      for (let i = 1; i <= maxNum; i++) {
        labels.push(i.toString())
        if (i <= (isPractice ? 4 : 12)) {
          labels.push(String.fromCharCode(64 + i)) // A, B, C...
        }
      }
      
      for (let i = 0; i < labels.length; i++) {
        let x, y, attempts = 0
        do {
          x = Math.random() * (containerWidth - margin * 2) + margin
          y = Math.random() * (containerHeight - margin * 2) + margin
          attempts++
        } while (
          attempts < 100 &&
          newCircles.some(c => Math.hypot(c.x - x, c.y - y) < minDistance)
        )
        newCircles.push({ id: i, label: labels[i], x, y, isClicked: false })
      }
    }

    return newCircles
  }, [])

  const startTest = useCallback((isPractice: boolean = false, part: 'A' | 'B') => {
    const newCircles = generateCircles(part, isPractice)
    setCircles(newCircles)
    setCurrentTarget(0)
    setErrors(0)
    setIsComplete(false)
    setElapsedTime(0)
    // Don't start timer yet - it will start on first click
    setStartTime(0)
    setCompletionTime(0)
  }, [generateCircles])

  useEffect(() => {
    if (gamePhase === 'practice-a' || gamePhase === 'test-a') {
      setTestPart('A')
      startTest(gamePhase === 'practice-a', 'A')
    } else if (gamePhase === 'practice-b' || gamePhase === 'test-b') {
      setTestPart('B')
      startTest(gamePhase === 'practice-b', 'B')
    }
  }, [gamePhase, startTest])

  useEffect(() => {
    if (!isComplete && startTime > 0) {
      const interval = setInterval(() => {
        setElapsedTime(performance.now() - startTime)
      }, 100)
      return () => clearInterval(interval)
    }
  }, [isComplete, startTime])

  const handleCircleClick = useCallback((circle: Circle) => {
    if (isComplete) return

    // Start timer on first click (after practice)
    if (startTime === 0 && currentTarget === 0) {
      setStartTime(performance.now())
    }

    if (circle.id === currentTarget) {
      // Correct click
      const newCircles = circles.map(c =>
        c.id === circle.id ? { ...c, isClicked: true } : c
      )
      setCircles(newCircles)
      
      const trialResult: TrialResult = {
        stimulus: circle.label,
        response: circle.label,
        correct: true,
        reactionTime: startTime > 0 ? performance.now() - startTime : 0,
        trialType: `TMT-${testPart}`
      }
      setResults(prev => [...prev, trialResult])

      if (currentTarget === circles.length - 1) {
        // Test complete
        const completedTime = performance.now() - startTime
        setCompletionTime(completedTime)
        setIsComplete(true)

        if (gamePhase === 'practice-a') {
          // Practice A complete, show transition to test A
          setTimeout(() => {
            setGamePhase('transition-a')
          }, 1500)
        } else if (gamePhase === 'test-a') {
          // Save TMT-A results and show transition to Part B
          setTmtATime(completedTime)
          setTmtAErrors(errors)
          setTimeout(() => {
            setGamePhase('transition-b')
          }, 1500)
        } else if (gamePhase === 'practice-b') {
          // Practice B complete, show transition to test B
          setTimeout(() => {
            setGamePhase('test-b')
          }, 1500)
        } else if (gamePhase === 'test-b') {
          // Both tests complete - calculate all metrics
          setTmtBTime(completedTime)
          setTmtBErrors(errors)
          
          setTimeout(() => {
            // Calculate metrics
            const differenceScore = completedTime - tmtATime // TMTB - TMTA
            const rateScore = tmtATime / completedTime // TMTA / TMTB (legacy field)
            const baRatio = tmtATime > 0 ? completedTime / tmtATime : 0 // TMTB / TMTA (standard B/A ratio)
            const totalErrors = tmtAErrors + errors

            onComplete(results, {
              score: Math.round(tmtATime + completedTime), // Total time for both parts
              accuracy: 100 - ((totalErrors / (25 * 2)) * 100), // Based on 25 circles each
              reactionTime: (tmtATime + completedTime) / 2,
              errorCount: totalErrors,
              errorRate: (totalErrors / (25 * 2)) * 100,
              details: {
                tmtATime: Math.round(tmtATime),
                tmtBTime: Math.round(completedTime),
                tmtAErrors: tmtAErrors,
                tmtBErrors: errors,
                totalErrors: totalErrors,
                differenceScore: Math.round(differenceScore),
                rateScore: rateScore.toFixed(3),
                baRatio: baRatio.toFixed(3)
              }
            })
          }, 2000)
        }
      } else {
        setCurrentTarget(prev => prev + 1)
      }
    } else {
      // Wrong click - count as error
      setErrors(prev => prev + 1)
      
      const trialResult: TrialResult = {
        stimulus: circles[currentTarget].label,
        response: circle.label,
        correct: false,
        reactionTime: startTime > 0 ? performance.now() - startTime : 0,
        trialType: `TMT-${testPart}`
      }
      setResults(prev => [...prev, trialResult])
    }
  }, [circles, currentTarget, isComplete, testPart, startTime, errors, tmtATime, gamePhase, onComplete, results])

  const handleInstructionNext = () => {
    if (instructionPage < 3) {
      setInstructionPage(prev => prev + 1)
    } else {
      setGamePhase('practice-a')
    }
  }

  const handleInstructionPrev = () => {
    if (instructionPage > 0) {
      setInstructionPage(prev => prev - 1)
    }
  }

  // Transition screen after Practice A
  if (gamePhase === 'transition-a') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card 
          className="max-w-2xl w-full p-8 shadow-2xl cursor-pointer hover:shadow-3xl transition-all border-2 border-blue-500/30 bg-blue-500/5"
          onClick={() => {
            setGamePhase('test-a')
          }}
        >
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Check size={64} weight="bold" className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Practice Part A Completed!</h2>
              <p className="text-xl text-muted-foreground">
                Now the actual TMT-A test begins.
              </p>
            </div>
            <div className="bg-muted/50 p-6 rounded-lg space-y-2">
              <p className="text-lg font-semibold">
                Your training trial is complete. The real test begins now. Focus!
              </p>
              <p className="text-sm text-muted-foreground">
                You'll connect 25 numbered circles (1 → 2 → 3... → 25)
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mt-3">
                ⏱️ Timer starts on your first click!
              </p>
            </div>
            <p className="text-primary font-semibold animate-pulse">
              Click anywhere to start TMT-A
            </p>
          </div>
        </Card>
      </div>
    )
  }

  // Transition screen between TMT-A and TMT-B
  if (gamePhase === 'transition-b') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card 
          className="max-w-2xl w-full p-8 shadow-2xl cursor-pointer hover:shadow-3xl transition-all border-2 border-purple-500/30 bg-purple-500/5"
          onClick={() => {
            setGamePhase('practice-b')
          }}
        >
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                <Check size={64} weight="bold" className="text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">TMT-A Complete!</h2>
              <div className="text-xl text-muted-foreground space-y-1">
                <p>Time: <span className="font-bold text-blue-600">{(tmtATime / 1000).toFixed(2)}s</span></p>
                <p>Errors: <span className="font-bold text-red-600">{tmtAErrors}</span></p>
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 p-6 rounded-lg space-y-3 border border-purple-300 dark:border-purple-700">
              <h3 className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                Now TMT-B will start!
              </h3>
              <p className="text-lg font-semibold">
                In Part B, you'll <strong>alternate between numbers and letters</strong>
              </p>
              <p className="text-base text-muted-foreground">
                Pattern: 1 → A → 2 → B → 3 → C → 4 → D...
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                First, you'll do a practice trial with 8 items to get familiar with Part B.
              </p>
            </div>
            <p className="text-primary font-semibold animate-pulse">
              Click anywhere to start Practice Part B
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (gamePhase === 'instructions') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-3xl w-full p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={instructionPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {instructionPage === 0 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">Trail Making Test</h1>
                    <Badge variant="outline" className="mb-4">Processing Speed & Executive Function</Badge>
                  </div>
                  
                  <div className="space-y-4 text-lg">
                    <p>
                      Welcome to the <strong>Trail Making Test (TMT)</strong>, one of the most widely 
                      used neuropsychological assessments for measuring processing speed, attention, 
                      and cognitive flexibility.
                    </p>
                    
                    <p>
                      This test has two parts that measure different cognitive abilities:
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-blue-500/30 bg-blue-500/5 p-4 rounded">
                        <h3 className="font-semibold text-blue-600 mb-2">Part A</h3>
                        <p className="text-sm">Connect numbers in sequence (1→2→3...)</p>
                        <p className="text-xs text-muted-foreground mt-2">Measures: Processing speed, visual scanning</p>
                      </div>
                      <div className="border border-purple-500/30 bg-purple-500/5 p-4 rounded">
                        <h3 className="font-semibold text-purple-600 mb-2">Part B</h3>
                        <p className="text-sm">Alternate numbers & letters (1→A→2→B...)</p>
                        <p className="text-xs text-muted-foreground mt-2">Measures: Executive function, task switching</p>
                      </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="font-semibold mb-2">What you'll do:</p>
                      <ul className="list-disc list-inside space-y-2">
                        <li>Click circles in the correct order as fast as you can</li>
                        <li>Connect them by following a sequence</li>
                        <li>Complete both Part A and Part B</li>
                        <li>Try to be both fast and accurate</li>
                      </ul>
                    </div>

                    <p className="text-muted-foreground text-base">
                      The TMT is used clinically to assess brain function and detect cognitive impairment. 
                      Faster times with fewer errors indicate better performance.
                    </p>
                  </div>
                </div>
              )}

              {instructionPage === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">How to Play</h1>
                    <Badge variant="outline" className="mb-4">Instructions</Badge>
                  </div>
                  
                  <div className="space-y-4 text-lg">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="font-semibold mb-3">Step-by-Step:</p>
                      <ol className="list-decimal list-inside space-y-3">
                        <li>
                          <strong>Look for the next target:</strong> The current target is shown at 
                          the top-right corner and will pulse on screen
                        </li>
                        <li>
                          <strong>Click the circles:</strong> Click each circle in the correct sequence 
                          as quickly as possible
                        </li>
                        <li>
                          <strong>Follow the pattern:</strong>
                          <ul className="ml-6 mt-2 space-y-1 text-base">
                            <li>• <strong className="text-blue-600">Part A:</strong> Numbers only (1, 2, 3, 4, 5...)</li>
                            <li>• <strong className="text-purple-600">Part B:</strong> Alternate (1, A, 2, B, 3, C...)</li>
                          </ul>
                        </li>
                        <li>
                          <strong>Complete both parts:</strong> Part A is completed first, then Part B begins automatically
                        </li>
                      </ol>
                    </div>

                    <div className="border-l-4 border-yellow-500 pl-4 py-2 bg-yellow-50 dark:bg-yellow-900/20">
                      <p className="text-base">
                        <strong>⚠️ Important:</strong> If you click the wrong circle, it counts as an 
                        error. Stay focused and click only the next target in the sequence!
                      </p>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
                      <Timer size={40} weight="fill" className="text-primary" />
                      <div>
                        <p className="font-semibold">Speed matters!</p>
                        <p className="text-sm text-muted-foreground">
                          Your completion time is tracked. Try to be as fast as possible while staying accurate.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {instructionPage === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">Tips & Scoring</h1>
                    <Badge variant="outline" className="mb-4">Maximize Your Performance</Badge>
                  </div>
                  
                  <div className="space-y-4 text-lg">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="font-semibold mb-3">Tips for Success:</p>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 font-bold mt-1">✓</span>
                          <span>Scan the screen quickly to locate the next target</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 font-bold mt-1">✓</span>
                          <span>Use your mouse efficiently - minimize hand movements</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 font-bold mt-1">✓</span>
                          <span>In Part B, remember the pattern: number, letter, number, letter...</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 font-bold mt-1">✓</span>
                          <span>The pulsing circle shows your current target</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 font-bold mt-1">✓</span>
                          <span>Completed circles turn green with connecting lines</span>
                        </li>
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-success/30 bg-success/5 p-3 rounded">
                        <h3 className="font-semibold text-success mb-1">Good Performance</h3>
                        <p className="text-sm">Fast completion time + Few or no errors</p>
                      </div>
                      <div className="border border-destructive/30 bg-destructive/5 p-3 rounded">
                        <h3 className="font-semibold text-destructive mb-1">Watch Out For</h3>
                        <p className="text-sm">Rushing and clicking wrong circles</p>
                      </div>
                    </div>

                    <div className="border-l-4 border-blue-500 pl-4 py-2">
                      <p className="text-base">
                        <strong>What we measure:</strong> Part A tests processing speed and visual 
                        scanning. Part B tests cognitive flexibility and the ability to switch between 
                        two mental tasks (executive function).
                      </p>
                    </div>

                    <p className="text-center text-muted-foreground text-base mt-6">
                      You'll start with a <strong className="text-yellow-600">practice trial</strong> (8 circles) 
                      to get familiar, then complete Part A (25 numbers) and Part B (25 items).
                    </p>
                  </div>
                </div>
              )}

              {instructionPage === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-100 text-lg px-4 py-2">
                      🎯 About the Practice Trial
                    </Badge>
                  </div>
                  
                  <div className="space-y-4 text-lg">
                    <p>
                      Before starting the actual test, you'll complete a <strong>practice trial with 8 circles</strong> to familiarize yourself with the task.
                    </p>
                    
                    <div className="bg-muted/50 p-6 rounded-lg space-y-3">
                      <p className="font-semibold mb-3">During practice, you will see:</p>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🎯</span>
                        <p className="text-base">
                          The <strong className="text-blue-600">current target circle will pulse</strong> to show which one to click next
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl text-green-600">✓</span>
                        <p className="text-base">
                          <strong className="text-green-600">Correct clicks</strong> turn the circle green and draw a line to it
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl text-red-600">✗</span>
                        <p className="text-base">
                          <strong className="text-red-600">Wrong clicks</strong> increase your error count but don't stop the test
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⏱</span>
                        <p className="text-base">
                          Your <strong>time is tracked</strong> from first click to last circle
                        </p>
                      </div>
                    </div>

                    <div className="bg-primary/10 p-4 rounded-lg border-l-4 border-primary">
                      <p className="text-base font-semibold">
                        💡 Pro Tip: Use the practice to plan your eye movements and mouse path. Look ahead to find the next circle while clicking!
                      </p>
                    </div>

                    <p className="text-center text-muted-foreground text-base mt-4">
                      After completing practice, you'll move on to the actual test with 25 circles.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  onClick={handleInstructionPrev}
                  variant="outline"
                  disabled={instructionPage === 0}
                >
                  Previous
                </Button>
                
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(page => (
                    <div
                      key={page}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        page === instructionPage ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>

                <Button onClick={handleInstructionNext}>
                  {instructionPage === 3 ? 'Start Practice' : 'Next'}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <div className="p-3 sm:p-4 md:p-6 border-b border-border/50 backdrop-blur-sm bg-card/50 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
          {(gamePhase === 'practice-a' || gamePhase === 'practice-b') && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-100 gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2">
              <Lightning size={16} className="sm:hidden" weight="fill" />
              <Lightning size={20} className="hidden sm:block" weight="fill" />
              <span className="text-xs sm:text-sm md:text-lg font-bold">Practice - Part {testPart}</span>
            </Badge>
          )}
          {(gamePhase === 'test-a' || gamePhase === 'test-b') && (
            <Badge variant="outline" className="gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2">
              <Lightning size={16} className="sm:hidden text-primary" weight="fill" />
              <Lightning size={20} className="hidden sm:block text-primary" weight="fill" />
              <div className="flex flex-col items-start">
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Test Part</span>
                <span className="text-sm sm:text-lg md:text-2xl font-bold text-foreground">TMT-{testPart}</span>
              </div>
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2">
            <Timer size={16} className="sm:hidden" weight="fill" />
            <Timer size={20} className="hidden sm:block" weight="fill" />
            <div className="flex flex-col items-start">
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Time</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-foreground">
                {startTime === 0 ? '0.0s' : (elapsedTime / 1000).toFixed(1) + 's'}
              </span>
            </div>
          </Badge>
          <Badge variant="outline" className="gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2">
            <div className="flex flex-col items-start">
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Progress</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-primary">
                {currentTarget + 1}/{circles.length}
              </span>
            </div>
          </Badge>
          <Badge variant="outline" className="gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2">
            <div className="flex flex-col items-start">
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Errors</span>
              <span className="text-sm sm:text-lg md:text-xl font-bold text-destructive">
                {errors}
              </span>
            </div>
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onExit} className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0">
          <X size={18} className="sm:hidden" />
          <X size={20} className="hidden sm:block md:hidden" />
          <X size={24} className="hidden md:block" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-8 overflow-hidden">
        <Card 
          ref={containerRef}
          className="relative bg-card/80 backdrop-blur-sm border-2 w-full max-w-[1000px] aspect-[3/4] sm:aspect-[4/3] md:aspect-[5/3] overflow-hidden"
        >
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-success/10 rounded-lg z-10"
              >
                <div className="text-center p-4">
                  <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">✓</div>
                  {(gamePhase === 'practice-a' || gamePhase === 'practice-b') ? (
                    <>
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-success">
                        Practice Part {testPart} Complete!
                      </div>
                      <div className="text-sm sm:text-base md:text-lg text-muted-foreground mt-1 sm:mt-2">
                        Time: {(completionTime / 1000).toFixed(2)}s | Errors: {errors}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-success">
                        TMT-{testPart} Complete!
                      </div>
                      <div className="text-sm sm:text-base md:text-lg text-muted-foreground mt-1 sm:mt-2">
                        Time: {(completionTime / 1000).toFixed(2)}s | Errors: {errors}
                      </div>
                      {gamePhase === 'test-a' && (
                        <div className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-4">
                          Transitioning to Part B...
                        </div>
                      )}
                      {gamePhase === 'test-b' && (
                        <div className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-4">
                          Test complete! Calculating results...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 text-xs sm:text-sm text-muted-foreground max-w-[200px] sm:max-w-none">
            {(gamePhase === 'practice-a' || gamePhase === 'test-a')
              ? 'Connect: 1 → 2 → 3 → ...'
              : '1 → A → 2 → B → ...'
            }
            {startTime === 0 && (
              <div className="text-primary font-semibold mt-1 text-[10px] sm:text-sm">
                ⏱️ Timer starts on first click!
              </div>
            )}
          </div>

          {circles.map((circle, index) => {
            const isTarget = circle.id === currentTarget
            const isCompleted = circle.isClicked
            const isPrevious = circle.id < currentTarget
            
            // Scale circle position based on container size
            const scaleX = containerSize.width / BASE_WIDTH
            const scaleY = containerSize.height / BASE_HEIGHT
            const scaledX = circle.x * scaleX
            const scaledY = circle.y * scaleY
            // Scale circle size based on container (smaller on mobile)
            const circleSize = Math.max(32, Math.min(64, containerSize.width / 16))

            return (
              <motion.div
                key={circle.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                style={{
                  position: 'absolute',
                  left: scaledX,
                  top: scaledY,
                  transform: `translate(-50%, -50%)`,
                }}
              >
                <motion.button
                  whileHover={!isCompleted ? { scale: 1.1 } : {}}
                  whileTap={!isCompleted ? { scale: 0.95 } : {}}
                  onClick={() => handleCircleClick(circle)}
                  disabled={isCompleted}
                  style={{ width: circleSize, height: circleSize, fontSize: circleSize * 0.35 }}
                  className={`
                    rounded-full border-2 sm:border-3 font-bold
                    transition-all duration-200 relative
                    ${isCompleted 
                      ? 'bg-success border-success text-white cursor-default' 
                      : 'bg-card border-border hover:border-primary hover:bg-primary/10'
                    }
                  `}
                >
                  {circle.label}
                  
                  {/* Draw line to previous circle */}
                  {isPrevious && index > 0 && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{
                        left: circleSize / 2,
                        top: circleSize / 2,
                        width: Math.abs((circles[index - 1].x * scaleX) - scaledX) + circleSize,
                        height: Math.abs((circles[index - 1].y * scaleY) - scaledY) + circleSize,
                        transform: `translate(-${circleSize / 2}px, -${circleSize / 2}px)`,
                      }}
                    >
                      <line
                        x1={circleSize / 2}
                        y1={circleSize / 2}
                        x2={(circles[index - 1].x * scaleX) - scaledX + (circleSize / 2)}
                        y2={(circles[index - 1].y * scaleY) - scaledY + (circleSize / 2)}
                        stroke="oklch(0.65 0.25 255)"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    </svg>
                  )}
                </motion.button>
              </motion.div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
