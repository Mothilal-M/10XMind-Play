import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { X, Cube, Check } from '@phosphor-icons/react'
import { TrialResult, GameSummary } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Checkbox } from '@/components/ui/checkbox'

interface MentalRotationTestProps {
  onComplete: (results: TrialResult[], summary: GameSummary) => void
  onExit: () => void
}

interface Question {
  target: string
  targetRotation: number
  options: Array<{
    figure: string
    rotation: number
    isMirror: boolean
    isDifferent: boolean
    isCorrect: boolean
  }>
  correctIndices: number[]
}

type GamePhase = 'instructions' | 'practice' | 'test'

const TOTAL_QUESTIONS = 24
const PRACTICE_QUESTIONS = 3
const MAX_SCORE = 48 // 24 questions × 2 correct answers each

export function MentalRotationTest({ onComplete, onExit }: MentalRotationTestProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions')
  const [instructionPage, setInstructionPage] = useState(0)
  const [practiceComplete, setPracticeComplete] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [questionData, setQuestionData] = useState<Question | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set())
  const [startTime, setStartTime] = useState(0)
  const [results, setResults] = useState<TrialResult[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [questionResults, setQuestionResults] = useState<Array<{
    correct: number
    incorrect: number
    mirrorErrors: number
    differentFigureErrors: number
  }>>([])
  
  // Responsive sizing for figures
  const [figureSize, setFigureSize] = useState({ target: 180, option: 160 })
  
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      if (width < 640) {
        setFigureSize({ target: 80, option: 60 })
      } else if (width < 768) {
        setFigureSize({ target: 120, option: 100 })
      } else {
        setFigureSize({ target: 180, option: 160 })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const figures = [
    'fig1', 'fig2', 'fig3', 'fig4', 'fig5', 'fig6', 'fig7', 'fig8',
    'fig9', 'fig10', 'fig11', 'fig12', 'fig13', 'fig14', 'fig15', 'fig16'
  ]

  const rotations = [0, 45, 90, 135, 180, 225, 270, 315]

  const generateQuestion = useCallback((): Question => {
    const targetFigure = figures[Math.floor(Math.random() * figures.length)]
    const targetRotation = rotations[Math.floor(Math.random() * rotations.length)]

    // Create options array
    const options = [
      // 2 correct answers (rotated versions of target)
      {
        figure: targetFigure,
        rotation: rotations[Math.floor(Math.random() * rotations.length)],
        isMirror: false,
        isDifferent: false,
        isCorrect: true
      },
      {
        figure: targetFigure,
        rotation: rotations[Math.floor(Math.random() * rotations.length)],
        isMirror: false,
        isDifferent: false,
        isCorrect: true
      },
      // 2 mirror images (incorrect)
      {
        figure: targetFigure,
        rotation: rotations[Math.floor(Math.random() * rotations.length)],
        isMirror: true,
        isDifferent: false,
        isCorrect: false
      },
      {
        figure: targetFigure,
        rotation: rotations[Math.floor(Math.random() * rotations.length)],
        isMirror: true,
        isDifferent: false,
        isCorrect: false
      }
    ]

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }

    // Find correct indices after shuffle
    const correctIndices = options
      .map((opt, idx) => opt.isCorrect ? idx : -1)
      .filter(idx => idx !== -1)

    return {
      target: targetFigure,
      targetRotation,
      options,
      correctIndices
    }
  }, [])

  const startNextQuestion = useCallback(() => {
    const maxQuestions = gamePhase === 'practice' ? PRACTICE_QUESTIONS : TOTAL_QUESTIONS
    
    if (currentQuestion >= maxQuestions) {
      if (gamePhase === 'practice') {
        setPracticeComplete(true)
        return
      }
      
      // Calculate final results
      const totalCorrectSelections = questionResults.reduce((sum, q) => sum + q.correct, 0)
      const totalIncorrectSelections = questionResults.reduce((sum, q) => sum + q.incorrect, 0)
      const totalMirrorErrors = questionResults.reduce((sum, q) => sum + q.mirrorErrors, 0)
      const totalDifferentFigureErrors = questionResults.reduce((sum, q) => sum + q.differentFigureErrors, 0)
      
      const avgRT = results.reduce((sum, r) => sum + r.reactionTime, 0) / results.length
      const correctTrials = results.filter(r => r.correct)
      const correctRT = correctTrials.length > 0
        ? correctTrials.reduce((sum, r) => sum + r.reactionTime, 0) / correctTrials.length
        : 0

      onComplete(results, {
        score: totalCorrectSelections,
        accuracy: (totalCorrectSelections / MAX_SCORE) * 100,
        reactionTime: avgRT,
        errorCount: totalIncorrectSelections,
        errorRate: (totalIncorrectSelections / MAX_SCORE) * 100,
        details: {
          maxScore: MAX_SCORE,
          totalQuestions: TOTAL_QUESTIONS,
          correctSelections: totalCorrectSelections,
          incorrectSelections: totalIncorrectSelections,
          mirrorErrors: totalMirrorErrors,
          differentFigureErrors: totalDifferentFigureErrors,
          avgReactionTime: Math.round(avgRT),
          meanReactionTime: Math.round(avgRT),
          correctReactionTime: Math.round(correctRT)
        }
      })
      return
    }

    setShowFeedback(false)
    setSelectedOptions(new Set())
    const question = generateQuestion()
    setQuestionData(question)
    setStartTime(performance.now())
  }, [currentQuestion, results, questionResults, gamePhase, generateQuestion, onComplete])

  useEffect(() => {
    if (gamePhase === 'test' || gamePhase === 'practice') {
      startNextQuestion()
    }
  }, [gamePhase])

  const handleSubmit = useCallback(() => {
    if (!questionData || showFeedback || selectedOptions.size === 0) return

    const reactionTime = performance.now() - startTime
    const selectedArray = Array.from(selectedOptions)
    
    // Check each selected option
    let correctCount = 0
    let incorrectCount = 0
    let mirrorErrors = 0
    let differentFigureErrors = 0
    
    selectedArray.forEach(idx => {
      const option = questionData.options[idx]
      if (option.isCorrect) {
        correctCount++
      } else {
        incorrectCount++
        if (option.isMirror) {
          mirrorErrors++
        } else if (option.isDifferent) {
          differentFigureErrors++
        }
      }
    })

    // Track missed correct answers
    const missedCorrect = questionData.correctIndices.filter(
      idx => !selectedOptions.has(idx)
    ).length

    const questionResult = {
      correct: correctCount,
      incorrect: incorrectCount,
      mirrorErrors,
      differentFigureErrors
    }
    
    setQuestionResults(prev => [...prev, questionResult])

    // Create trial result for this question
    const trialResult: TrialResult = {
      stimulus: `Question ${currentQuestion + 1}: ${questionData.target}@${questionData.targetRotation}°`,
      response: `Selected: ${selectedArray.map(i => i + 1).join(',')} | Correct: ${questionData.correctIndices.map(i => i + 1).join(',')}`,
      correct: correctCount === 2 && incorrectCount === 0,
      reactionTime,
      trialType: 'mental-rotation',
      status: correctCount === 2 && incorrectCount === 0 ? 1 : 2
    }

    if (gamePhase === 'test') {
      setResults(prev => [...prev, trialResult])
    }
    
    setShowFeedback(true)

    setTimeout(() => {
      setCurrentQuestion(prev => prev + 1)
      startNextQuestion()
    }, gamePhase === 'practice' ? 2000 : 1200)
  }, [questionData, showFeedback, selectedOptions, startTime, currentQuestion, gamePhase, startNextQuestion])

  const toggleOption = (index: number) => {
    if (showFeedback) return
    
    setSelectedOptions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        // Limit to maximum 2 selections
        if (newSet.size < 2) {
          newSet.add(index)
        }
      }
      return newSet
    })
  }

  // Render 3D isometric block figures (helper function to draw a cube)
  const drawCube = (x: number, y: number, scale: number = 1) => {
    const w = 20 * scale  // cube width
    const h = 20 * scale  // cube height
    const d = 12 * scale  // depth offset
    
    return (
      <g key={`${x}-${y}`}>
        {/* Top face */}
        <path 
          d={`M${x},${y} L${x + w},${y - d} L${x + w + w},${y} L${x + w},${y + d} Z`} 
          fill="#4A5568" 
          stroke="#2D3748" 
          strokeWidth="0.5"
        />
        {/* Left face */}
        <path 
          d={`M${x},${y} L${x + w},${y + d} L${x + w},${y + d + h} L${x},${y + h} Z`} 
          fill="#2D3748" 
          stroke="#1A202C" 
          strokeWidth="0.5"
        />
        {/* Right face */}
        <path 
          d={`M${x + w},${y + d} L${x + w + w},${y} L${x + w + w},${y + h} L${x + w},${y + d + h} Z`} 
          fill="#1A202C" 
          stroke="#000" 
          strokeWidth="0.5"
        />
      </g>
    )
  }

  // Render 3D block figures
  const renderShape = (figType: string, rotation: number, isMirror: boolean, size: number = 150) => {
    // Define figures as arrays of [x, y] cube positions - simplified with 3-4 cubes each
    const figureShapes: Record<string, Array<[number, number]>> = {
      // Simple L-shape (3 cubes)
      fig1: [[0, 20], [0, 0], [20, 0]],
      
      // Simple corner (3 cubes)
      fig2: [[0, 0], [20, 0], [20, 20]],
      
      // Line with one up (3 cubes)
      fig3: [[0, 20], [0, 0], [20, 20]],
      
      // Backwards L (3 cubes)
      fig4: [[0, 0], [20, 0], [0, 20]],
      
      // T-shape (4 cubes)
      fig5: [[0, 20], [20, 20], [40, 20], [20, 0]],
      
      // Small zigzag (3 cubes)
      fig6: [[0, 0], [20, 0], [20, 20]],
      
      // L pointing down (3 cubes)
      fig7: [[0, 0], [0, 20], [20, 20]],
      
      // Angle (3 cubes)
      fig8: [[20, 0], [0, 20], [20, 20]],
      
      // Small staircase (4 cubes)
      fig9: [[0, 20], [20, 20], [20, 0], [40, 0]],
      
      // Corner shape (4 cubes)
      fig10: [[0, 0], [20, 0], [20, 20], [40, 20]],
      
      // Extended L (4 cubes)
      fig11: [[0, 0], [0, 20], [0, 40], [20, 0]],
      
      // Z-pattern (4 cubes)
      fig12: [[0, 0], [20, 0], [20, 20], [40, 20]],
      
      // Wide L (4 cubes)
      fig13: [[0, 20], [20, 20], [40, 20], [0, 0]],
      
      // Step pattern (4 cubes)
      fig14: [[0, 20], [20, 20], [20, 0], [40, 20]],
      
      // Long corner (4 cubes)
      fig15: [[0, 0], [20, 0], [40, 0], [0, 20]],
      
      // Diagonal step (4 cubes)
      fig16: [[0, 40], [20, 20], [40, 0], [20, 0]]
    }    
    const cubePositions = figureShapes[figType] || figureShapes.fig1
    
    // Calculate bounds for centering
    const xs = cubePositions.map(p => p[0])
    const ys = cubePositions.map(p => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const centerX = (minX + maxX) / 2 + 20
    const centerY = (minY + maxY) / 2 + 20

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        className="inline-block"
        style={{
          transform: `rotate(${rotation}deg) scaleX(${isMirror ? -1 : 1})`,
          filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))'
        }}
      >
        <g transform={`translate(${60 - centerX}, ${60 - centerY})`}>
          {cubePositions.map(([x, y]) => drawCube(x, y, 1))}
        </g>
      </svg>
    )
  }

  const handleInstructionNext = () => {
    if (instructionPage < 2) {
      setInstructionPage(prev => prev + 1)
    } else {
      setGamePhase('practice')
      setCurrentQuestion(0)
    }
  }

  const handleInstructionPrev = () => {
    if (instructionPage > 0) {
      setInstructionPage(prev => prev - 1)
    }
  }

  // Practice complete transition screen
  if (practiceComplete) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card 
          className="max-w-2xl w-full p-8 shadow-2xl cursor-pointer hover:shadow-3xl transition-all border-2 border-green-500/30 bg-green-500/5"
          onClick={() => {
            setPracticeComplete(false)
            setGamePhase('test')
            setCurrentQuestion(0)
            setResults([])
            setQuestionResults([])
          }}
        >
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <Check size={64} weight="bold" className="text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">Practice Completed!</h2>
              <p className="text-xl text-gray-600">
                You are now ready for the actual test.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg space-y-2 border">
              <p className="text-lg font-semibold text-gray-900">
                The real test begins now. Focus!
              </p>
              <p className="text-sm text-gray-600">
                You'll complete {TOTAL_QUESTIONS} questions. Select 2 correct rotations for each target figure.
              </p>
            </div>
            <p className="text-blue-600 font-semibold animate-pulse">
              Click anywhere to start
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (gamePhase === 'instructions') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-4xl w-full p-8 bg-white border-2">
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
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <Cube size={40} className="text-blue-600" />
                      <h1 className="text-4xl font-bold text-gray-900">Mental Rotation Test</h1>
                    </div>
                    <Badge variant="outline" className="mb-4 border-gray-300 text-gray-700">Spatial Reasoning Assessment</Badge>
                  </div>
                  
                  <div className="space-y-4 text-lg text-gray-700">
                    <p>
                      This test measures your ability to <strong>mentally rotate 3D objects</strong> in space.
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                      <h3 className="font-semibold text-xl text-gray-900 mb-3">How it works:</h3>
                      <ul className="space-y-2 list-disc list-inside">
                        <li>You will see a <strong>target figure</strong> on the left</li>
                        <li>You must find <strong>2 correct rotations</strong> from 4 options</li>
                        <li>Select the 2 figures that are the same as the target (just rotated)</li>
                        <li>Avoid mirror images and different figures</li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                      <p className="font-semibold text-gray-900 mb-2">Scoring:</p>
                      <ul className="space-y-1 text-base">
                        <li>• Total Questions: <strong>{TOTAL_QUESTIONS}</strong></li>
                        <li>• Correct Answers per Question: <strong>2</strong></li>
                        <li>• Maximum Score: <strong>{MAX_SCORE}</strong> points</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {instructionPage === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">What to Avoid</h1>
                    <Badge variant="outline" className="mb-4 border-gray-300 text-gray-700">Important Distinctions</Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-red-50 border-2 border-red-300 p-6 rounded-lg">
                      <h3 className="font-semibold text-xl text-red-900 mb-3">❌ Mirror Images</h3>
                      <p className="text-gray-700 mb-3">
                        These look similar but are <strong>flipped</strong> (like looking in a mirror). 
                        They are <strong>NOT</strong> correct answers.
                      </p>
                      <div className="bg-white p-4 rounded border border-red-200">
                        <p className="text-sm text-gray-600 italic">
                          Think of it like your left and right hands - same shape, but mirror images!
                        </p>
                      </div>
                    </div>

                    <div className="bg-orange-50 border-2 border-orange-300 p-6 rounded-lg">
                      <h3 className="font-semibold text-xl text-orange-900 mb-3">❌ Different Figures</h3>
                      <p className="text-gray-700 mb-3">
                        These are <strong>completely different shapes</strong>. 
                        They may look similar at first glance, but they are <strong>NOT</strong> the same figure.
                      </p>
                    </div>

                    <div className="bg-green-50 border-2 border-green-300 p-6 rounded-lg">
                      <h3 className="font-semibold text-xl text-green-900 mb-3">✓ Correct Rotations</h3>
                      <p className="text-gray-700">
                        These are the <strong>same figure as the target</strong>, just turned/rotated in different directions. 
                        Always select exactly <strong>2 correct rotations</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {instructionPage === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-lg px-4 py-2">
                      🎯 Practice Session
                    </Badge>
                  </div>
                  
                  <div className="space-y-4 text-lg text-gray-700">
                    <p>
                      You'll start with <strong>{PRACTICE_QUESTIONS} practice questions</strong> to familiarize yourself with the task.
                    </p>
                    
                    <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg space-y-3">
                      <p className="font-semibold text-gray-900 mb-3">During each question:</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">1️⃣</span>
                          <p>Look at the <strong>target figure</strong> on the left</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">2️⃣</span>
                          <p>Check each of the <strong>4 options</strong> on the right</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">3️⃣</span>
                          <p>Click the checkboxes to select <strong>exactly 2 correct rotations</strong></p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">4️⃣</span>
                          <p>Click <strong>"Submit Answer"</strong> when ready</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                      <p className="font-semibold text-gray-900">
                        💡 Tip: Take your time to mentally rotate the target figure and compare it carefully with each option!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <Button
                  onClick={handleInstructionPrev}
                  variant="outline"
                  disabled={instructionPage === 0}
                  className="border-gray-300"
                >
                  Previous
                </Button>
                
                <div className="flex gap-2">
                  {[0, 1, 2].map(page => (
                    <div
                      key={page}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        page === instructionPage ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>

                <Button 
                  onClick={handleInstructionNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {instructionPage === 2 ? 'Start Practice' : 'Next'}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
    )
  }

  const maxQuestions = gamePhase === 'practice' ? PRACTICE_QUESTIONS : TOTAL_QUESTIONS

  return (
    <div className="min-h-screen bg-white dark:bg-background flex flex-col">
      <div className="p-3 sm:p-4 md:p-6 border-b-2 border-gray-200 dark:border-border bg-white dark:bg-background flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap flex-1">
          {gamePhase === 'practice' && (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-100 gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2">
              <span className="text-xs sm:text-sm md:text-lg font-bold">Practice</span>
            </Badge>
          )}
          {gamePhase === 'test' && (
            <Badge variant="outline" className="gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2 border-gray-300 dark:border-border">
              <Cube size={16} className="sm:hidden text-blue-600" />
              <Cube size={20} className="hidden sm:block text-blue-600" />
              <div className="flex flex-col items-start">
                <span className="text-[10px] sm:text-xs text-gray-600 dark:text-muted-foreground hidden sm:block">Mental Rotation</span>
                <span className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 dark:text-foreground">Q{currentQuestion + 1}/{maxQuestions}</span>
              </div>
            </Badge>
          )}
          <div className="w-20 sm:w-32 md:w-64">
            <Progress value={((currentQuestion) / maxQuestions) * 100} className="h-1.5 sm:h-2" />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onExit} className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0">
          <X size={18} className="sm:hidden" />
          <X size={20} className="hidden sm:block md:hidden" />
          <X size={24} className="hidden md:block" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-8 overflow-auto">
        {questionData && (
          <div className="max-w-6xl w-full">
            <Card className="p-3 sm:p-4 md:p-8 bg-white dark:bg-card border-2 border-gray-200 dark:border-border shadow-lg">
              <div className="mb-3 sm:mb-4 md:mb-6 text-center">
                <h2 className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-foreground mb-1 sm:mb-2">
                  Select the 2 correct rotations of the target
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-muted-foreground hidden sm:block">
                  Choose exactly 2 options that match the target (2 are correct rotations, 2 are mirror images)
                </p>
              </div>

              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 md:gap-8 items-center lg:items-start justify-center">
                {/* Target Figure */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="bg-gray-100 dark:bg-muted border-2 sm:border-4 border-blue-500 rounded-lg p-3 sm:p-4 md:p-8 mb-2 sm:mb-3">
                    <div className="text-center mb-1 sm:mb-2">
                      <Badge className="bg-blue-600 text-white mb-1 sm:mb-3 text-xs sm:text-sm">TARGET</Badge>
                    </div>
                    <div className="w-[80px] sm:w-[120px] md:w-[180px] h-[80px] sm:h-[120px] md:h-[180px] flex items-center justify-center">
                      {renderShape(questionData.target, questionData.targetRotation, false, figureSize.target)}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-muted-foreground">Target</p>
                </div>

                {/* Options Grid */}
                <div className="flex-1 w-full">
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6">
                    {questionData.options.map((option, idx) => {
                      const isSelected = selectedOptions.has(idx)
                      const isCorrect = option.isCorrect
                      const showResult = showFeedback

                      let borderColor = 'border-gray-300 dark:border-border'
                      let bgColor = 'bg-white dark:bg-card'
                      
                      if (showResult) {
                        if (isCorrect && isSelected) {
                          borderColor = 'border-green-500'
                          bgColor = 'bg-green-50 dark:bg-green-900/20'
                        } else if (isCorrect && !isSelected) {
                          borderColor = 'border-orange-500'
                          bgColor = 'bg-orange-50 dark:bg-orange-900/20'
                        } else if (!isCorrect && isSelected) {
                          borderColor = 'border-red-500'
                          bgColor = 'bg-red-50 dark:bg-red-900/20'
                        }
                      } else if (isSelected) {
                        borderColor = 'border-blue-500'
                        bgColor = 'bg-blue-50 dark:bg-blue-900/20'
                      }

                      return (
                        <div
                          key={idx}
                          className={`${bgColor} border-2 ${borderColor} rounded-lg p-2 sm:p-4 md:p-6 transition-all cursor-pointer hover:shadow-md relative`}
                          onClick={() => !showFeedback && toggleOption(idx)}
                        >
                          <div className="absolute top-1 sm:top-2 md:top-3 left-1 sm:left-2 md:left-3 flex items-center gap-1 sm:gap-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => !showFeedback && toggleOption(idx)}
                              className="border-gray-400 h-3 w-3 sm:h-4 sm:w-4"
                            />
                            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700 dark:text-muted-foreground">{idx + 1}</span>
                          </div>
                          
                          {showResult && (
                            <div className="absolute top-1 sm:top-2 md:top-3 right-1 sm:right-2 md:right-3">
                              {isCorrect && isSelected && (
                                <Badge className="bg-green-600 text-white text-[8px] sm:text-xs px-1 sm:px-2">✓</Badge>
                              )}
                              {isCorrect && !isSelected && (
                                <Badge className="bg-orange-600 text-white text-[8px] sm:text-xs px-1 sm:px-2">Miss</Badge>
                              )}
                              {!isCorrect && isSelected && (
                                <Badge className="bg-red-600 text-white text-[8px] sm:text-xs px-1 sm:px-2">
                                  ✗
                                </Badge>
                              )}
                            </div>
                          )}

                          <div className="flex justify-center mt-5 sm:mt-6 md:mt-8">
                            <div className="w-[60px] sm:w-[100px] md:w-[160px] h-[60px] sm:h-[100px] md:h-[160px] flex items-center justify-center">
                              {renderShape(option.figure, option.rotation, option.isMirror, figureSize.option)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {!showFeedback && (
                    <div className="mt-3 sm:mt-4 md:mt-6 flex justify-center">
                      <Button
                        onClick={handleSubmit}
                        disabled={selectedOptions.size === 0}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-4 md:py-6 text-sm sm:text-base md:text-lg"
                      >
                        Submit ({selectedOptions.size}/2)
                      </Button>
                    </div>
                  )}

                  {showFeedback && gamePhase === 'practice' && (
                    <div className="mt-3 sm:mt-4 md:mt-6 text-center">
                      <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-muted-foreground">Moving to next question...</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
