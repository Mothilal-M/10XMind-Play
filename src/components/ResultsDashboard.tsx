import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { resultsAPI } from '@/lib/api-client'
import { GameResult } from '@/lib/types'
import { GAMES } from '@/lib/games'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, ChartBar, Confetti, TrendUp, Trophy, Sparkle, Brain } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ThemeToggle'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Skeleton } from '@/components/ui/skeleton'
import { staggerContainer, staggerItem, springs, fadeInUp } from '@/lib/animations'

// Animated stat card with intersection observer
const AnimatedStatCard = ({ children, index = 0 }: { children: React.ReactNode, index?: number }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1, ...springs.smooth }}
    >
      {children}
    </motion.div>
  )
}

// Loading skeleton for results
const ResultsSkeleton = () => (
  <div className="space-y-6">
    {[1, 2].map((i) => (
      <Card key={i} className="border-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
)

interface ResultsDashboardProps {
  onBack: () => void
}

// Helper to convert API response to GameResult
function apiToGameResult(apiResult: any): GameResult {
  return {
    id: apiResult.id,
    userId: apiResult.userId,
    userEmail: '', // Not returned by API
    gameId: apiResult.gameId,
    score: apiResult.score,
    reactionTime: apiResult.reactionTime,
    accuracy: apiResult.accuracy,
    errorCount: apiResult.errorCount,
    errorRate: apiResult.errorRate,
    // completed_at is a Postgres BIGINT returned as a string; coerce so `new Date()` works
    timestamp: Number(apiResult.completedAt),
    details: apiResult.details
  }
}

export function ResultsDashboard({ onBack }: ResultsDashboardProps) {
  const { user } = useAuth()
  const [userResults, setUserResults] = useState<GameResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const results = await resultsAPI.getResults()
        setUserResults(results.map(apiToGameResult))
      } catch (error) {
        console.error('Failed to fetch results:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <ResultsSkeleton />
        </main>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

  }

  const getGameName = (gameId: string) => {
    return GAMES.find(g => g.id === gameId)?.name || gameId
  }

  const getPerformanceBadge = (accuracy: number) => {
    if (accuracy >= 90) return { label: 'Excellent', variant: 'default' as const, gradient: 'from-green-500 to-emerald-500' }
    if (accuracy >= 75) return { label: 'Good', variant: 'secondary' as const, gradient: 'from-blue-500 to-cyan-500' }
    if (accuracy >= 60) return { label: 'Fair', variant: 'outline' as const, gradient: 'from-yellow-500 to-orange-500' }
    return { label: 'Practice', variant: 'outline' as const, gradient: 'from-gray-500 to-gray-600' }
  }

  const groupedResults = userResults.reduce((acc, result) => {
    if (!acc[result.gameId]) {
      acc[result.gameId] = []
    }
    acc[result.gameId].push(result)
    return acc
  }, {} as Record<string, GameResult[]>)

  return (
    <div className="min-h-screen bg-background relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <motion.div whileHover={{ x: -4 }} whileTap={{ scale: 0.98 }}>
              <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 transition-all">
                <ArrowLeft size={18} weight="duotone" />
                Back to Dashboard
              </Button>
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ThemeToggle />
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <motion.div 
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/25"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={springs.bouncy}
            >
              <ChartBar size={26} weight="duotone" className="text-white" />
            </motion.div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Your Results</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Track your cognitive performance across all games
              </p>
            </div>
          </div>
        </motion.div>

        {userResults.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="border-2 shadow-xl backdrop-blur-sm bg-card/95">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-6 relative"
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/10"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <Brain size={48} weight="duotone" className="text-muted-foreground relative z-10" />
                </motion.div>
                <motion.p 
                  className="text-xl text-foreground mb-2 font-bold"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  No results yet
                </motion.p>
                <motion.p 
                  className="text-sm text-muted-foreground mb-6 text-center max-w-sm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Complete your first game to see your performance metrics here
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    onClick={onBack} 
                    className="gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25 h-11 px-6 font-semibold"
                  >
                    <Sparkle size={18} weight="fill" />
                    Start Training
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div 
            className="flex flex-col gap-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {Object.entries(groupedResults).map(([gameId, gameResults], idx) => (
              <AnimatedStatCard key={gameId} index={idx}>
                <Card className="border-2 shadow-xl hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-card/95 overflow-hidden group">
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  
                  <CardHeader className="relative">
                    <div className="flex items-center gap-4">
                      <motion.div 
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/10 flex items-center justify-center shadow-lg border border-primary/10"
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        transition={springs.snappy}
                      >
                        <Trophy size={28} weight="duotone" className="text-primary" />
                      </motion.div>
                      <div>
                        <CardTitle className="text-xl">{getGameName(gameId)}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            {gameResults.length} attempts
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right">Accuracy</TableHead>
                            <TableHead className="text-right">Errors</TableHead>
                            <TableHead className="text-right">Avg RT (ms)</TableHead>
                            <TableHead className="text-right">Performance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gameResults
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .map((result, resultIdx) => {
                              const badge = getPerformanceBadge(result.accuracy)
                              return (
                                <motion.tr 
                                  key={result.id} 
                                  className="hover:bg-muted/50 transition-colors group/row"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: resultIdx * 0.05 }}
                                >
                                  <TableCell className="font-medium">{formatDate(result.timestamp)}</TableCell>
                                  <TableCell className="text-right font-bold">
                                    <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent text-lg">
                                      {result.score}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{result.accuracy.toFixed(1)}%</TableCell>
                                  <TableCell className="text-right">
                                    {result.errorCount !== undefined ? (
                                      <span className="text-destructive font-semibold">
                                        {result.errorCount} ({result.errorRate?.toFixed(1)}%)
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {result.reactionTime ? result.reactionTime.toFixed(0) : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge className={`bg-gradient-to-r ${badge.gradient} text-white shadow-md transition-transform group-hover/row:scale-105`}>
                                      {badge.label}
                                    </Badge>
                                  </TableCell>
                                </motion.tr>
                              )
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedStatCard>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}
