import jsPDF from 'jspdf';
import { GameResult, User } from './types';
import { GAMES } from './games';

// Helper function to extract last 3 digits of roll number for sorting
export function getLastThreeDigits(rollNo: string | undefined | null): number {
  if (!rollNo) return 999999; // Put entries without roll numbers at the end
  const digits = rollNo.replace(/\D/g, ''); // Remove non-digit characters
  if (digits.length === 0) return 999999;
  const lastThree = digits.slice(-3);
  return parseInt(lastThree, 10) || 999999;
}

// Helper function to sort by last 3 digits of roll number (ascending)
export function sortByRollNo<T extends { rollNo?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => getLastThreeDigits(a.rollNo) - getLastThreeDigits(b.rollNo));
}

// Helper function to sort students by last 3 digits of roll number
export function sortStudentsByRollNo(students: User[]): User[] {
  return [...students].sort((a, b) => getLastThreeDigits(a.rollNo) - getLastThreeDigits(b.rollNo));
}

export interface ExportData {
  students: User[]
  results: GameResult[]
  selectedStudent?: string
  selectedGame?: string
}

export function generateCSV(data: ExportData): string {
  const { students, results, selectedStudent, selectedGame } = data
  
  let filteredResults = results
  if (selectedStudent && selectedStudent !== 'all') {
    filteredResults = filteredResults.filter(r => r.userId === selectedStudent)
  }
  if (selectedGame && selectedGame !== 'all') {
    filteredResults = filteredResults.filter(r => r.gameId === selectedGame)
  }

  const headers = [
    'Date',
    'Student Email',
    'Student Name',
    'Roll Number',
    'Date of Birth',
    'Consent Date',
    'Game Name',
    'Score',
    'Accuracy (%)',
    'Reaction Time (ms)',
    'Result ID'
  ]

  // Sort results by roll number (last 3 digits ascending)
  const sortedResults = [...filteredResults].sort((a, b) => {
    const studentA = students.find(s => s.id === a.userId)
    const studentB = students.find(s => s.id === b.userId)
    return getLastThreeDigits(studentA?.rollNo || a.userRollNo) - getLastThreeDigits(studentB?.rollNo || b.userRollNo)
  })

  const rows = sortedResults.map(result => {
    const student = students.find(s => s.id === result.userId)
    const game = GAMES.find(g => g.id === result.gameId)
    const studentEmail = student?.email || result.userEmail || 'Unknown'
    
    return [
      new Date(result.timestamp).toLocaleString(),
      studentEmail,
      student?.name || 'N/A',
      student?.rollNo || 'N/A',
      student?.dob || 'N/A',
      student?.consentDate || 'N/A',
      game?.name || 'Unknown',
      result.score.toFixed(2),
      result.accuracy.toFixed(2),
      result.reactionTime?.toFixed(0) || 'N/A',
      result.id
    ]
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

export function downloadCSV(data: ExportData, filename: string = 'student-progress-report.csv'): void {
  const csv = generateCSV(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function generatePDF(data: ExportData): jsPDF {
  const { students, results, selectedStudent, selectedGame } = data
  
  let filteredResults = results
  if (selectedStudent && selectedStudent !== 'all') {
    filteredResults = filteredResults.filter(r => r.userId === selectedStudent)
  }
  if (selectedGame && selectedGame !== 'all') {
    filteredResults = filteredResults.filter(r => r.gameId === selectedGame)
  }

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  doc.setFontSize(20)
  doc.setTextColor(72, 84, 237)
  doc.text('10XMindPlay', margin, yPos)
  
  yPos += 8
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('Student Progress Report', margin, yPos)
  
  yPos += 10
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos)
  
  yPos += 15

  const studentFilter = selectedStudent === 'all' || !selectedStudent 
    ? 'All Students' 
    : students.find(s => s.id === selectedStudent)?.email || 'Unknown'
  const gameFilter = selectedGame === 'all' || !selectedGame
    ? 'All Games'
    : GAMES.find(g => g.id === selectedGame)?.name || 'Unknown'

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`Filter - Student: ${studentFilter}`, margin, yPos)
  yPos += 6
  doc.text(`Filter - Game: ${gameFilter}`, margin, yPos)
  yPos += 15

  if (filteredResults.length === 0) {
    doc.setTextColor(150, 150, 150)
    doc.text('No data available for the selected filters.', margin, yPos)
    return doc
  }

  const totalScore = filteredResults.reduce((sum, r) => sum + r.score, 0)
  const totalAccuracy = filteredResults.reduce((sum, r) => sum + r.accuracy, 0)
  const reactionTimes = filteredResults.filter(r => r.reactionTime).map(r => r.reactionTime!)
  const avgReactionTime = reactionTimes.length > 0 
    ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length 
    : 0

  doc.setFillColor(240, 240, 255)
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 40, 'F')
  
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary Statistics', margin + 5, yPos + 2)
  
  yPos += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Total Records: ${filteredResults.length}`, margin + 5, yPos)
  yPos += 6
  doc.text(`Average Score: ${(totalScore / filteredResults.length).toFixed(2)}`, margin + 5, yPos)
  yPos += 6
  doc.text(`Average Accuracy: ${(totalAccuracy / filteredResults.length).toFixed(2)}%`, margin + 5, yPos)
  yPos += 6
  doc.text(`Average Reaction Time: ${avgReactionTime > 0 ? avgReactionTime.toFixed(0) + 'ms' : 'N/A'}`, margin + 5, yPos)
  
  yPos += 20

  if (selectedStudent && selectedStudent !== 'all') {
    const student = students.find(s => s.id === selectedStudent)
    if (student) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('Student Details', margin, yPos)
      yPos += 8
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Email: ${student.email}`, margin + 5, yPos)
      yPos += 6
      if (student.name) {
        doc.text(`Name: ${student.name}`, margin + 5, yPos)
        yPos += 6
      }
      if (student.rollNo) {
        doc.text(`Roll Number: ${student.rollNo}`, margin + 5, yPos)
        yPos += 6
      }
      if (student.dob) {
        doc.text(`Date of Birth: ${student.dob}`, margin + 5, yPos)
        yPos += 6
      }
      if (student.consentDate) {
        doc.text(`Consent Date: ${student.consentDate}`, margin + 5, yPos)
        yPos += 6
      }
      doc.text(`Member Since: ${new Date(student.createdAt).toLocaleDateString()}`, margin + 5, yPos)
      yPos += 6
      doc.text(`Total Games Played: ${filteredResults.length}`, margin + 5, yPos)
      yPos += 15
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Detailed Results', margin, yPos)
  yPos += 10

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const colWidths = [35, 50, 25, 25, 30]
  const headers = ['Date', 'Game', 'Score', 'Accuracy', 'RT (ms)']
  
  let xPos = margin
  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos)
    xPos += colWidths[i]
  })
  
  yPos += 2
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(8)

  filteredResults.slice(0, 50).forEach((result, index) => {
    if (yPos > pageHeight - 30) {
      doc.addPage()
      yPos = margin
    }

    const game = GAMES.find(g => g.id === result.gameId)
    const date = new Date(result.timestamp).toLocaleDateString()
    
    xPos = margin
    const rowData = [
      date,
      game?.name || 'Unknown',
      result.score.toFixed(0),
      result.accuracy.toFixed(1) + '%',
      result.reactionTime?.toFixed(0) || 'N/A'
    ]
    
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(margin - 2, yPos - 4, pageWidth - 2 * margin + 4, 6, 'F')
    }
    
    rowData.forEach((cell, i) => {
      doc.text(cell, xPos, yPos)
      xPos += colWidths[i]
    })
    
    yPos += 6
  })

  if (filteredResults.length > 50) {
    yPos += 10
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(`Note: Showing first 50 of ${filteredResults.length} results`, margin, yPos)
  }

  const footerY = pageHeight - 10
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('10XMindPlay - Cognitive Training Platform', pageWidth / 2, footerY, { align: 'center' })

  return doc
}

export function downloadPDF(data: ExportData, filename: string = 'student-progress-report.pdf'): void {
  const doc = generatePDF(data)
  doc.save(filename)
}

export function generateStudentSummaryCSV(data: ExportData): string {
  const { students, results } = data
  
  const headers = [
    'Student Email',
    'Student Name',
    'Roll Number',
    'Date of Birth',
    'Consent Date',
    'Member Since',
    'Total Games Played',
    'Average Score',
    'Average Accuracy (%)',
    'Average Reaction Time (ms)',
    'Last Activity'
  ]

  // Sort students by roll number (last 3 digits ascending)
  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents
    .map(student => {
      const studentResults = results.filter(r => r.userId === student.id)
      
      if (studentResults.length === 0) {
        return [
          student.email,
          student.name || 'N/A',
          student.rollNo || 'N/A',
          student.dob || 'N/A',
          student.consentDate || 'N/A',
          new Date(student.createdAt).toLocaleDateString(),
          '0',
          'N/A',
          'N/A',
          'N/A',
          'Never'
        ]
      }

      const totalScore = studentResults.reduce((sum, r) => sum + r.score, 0)
      const totalAccuracy = studentResults.reduce((sum, r) => sum + r.accuracy, 0)
      const reactionTimes = studentResults.filter(r => r.reactionTime).map(r => r.reactionTime!)
      const avgReactionTime = reactionTimes.length > 0 
        ? (reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length).toFixed(0)
        : 'N/A'
      const lastActivity = new Date(Math.max(...studentResults.map(r => r.timestamp))).toLocaleDateString()

      return [
        student.email,
        student.name || 'N/A',
        student.rollNo || 'N/A',
        student.dob || 'N/A',
        student.consentDate || 'N/A',
        new Date(student.createdAt).toLocaleDateString(),
        studentResults.length.toString(),
        (totalScore / studentResults.length).toFixed(2),
        (totalAccuracy / studentResults.length).toFixed(2),
        avgReactionTime,
        lastActivity
      ]
    })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

export function downloadStudentSummaryCSV(data: ExportData, filename: string = 'student-summary-report.csv'): void {
  const csv = generateStudentSummaryCSV(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function generateGameSummaryCSV(data: ExportData): string {
  const { results, selectedStudent } = data
  
  let filteredResults = results
  if (selectedStudent && selectedStudent !== 'all') {
    filteredResults = filteredResults.filter(r => r.userId === selectedStudent)
  }

  const headers = [
    'Game Name',
    'Category',
    'Times Played',
    'Average Score',
    'Average Accuracy (%)',
    'Average Reaction Time (ms)'
  ]

  const rows = GAMES.map(game => {
    const gameResults = filteredResults.filter(r => r.gameId === game.id)
    
    if (gameResults.length === 0) {
      return [
        game.name,
        game.category,
        '0',
        'N/A',
        'N/A',
        'N/A'
      ]
    }

    const totalScore = gameResults.reduce((sum, r) => sum + r.score, 0)
    const totalAccuracy = gameResults.reduce((sum, r) => sum + r.accuracy, 0)
    const reactionTimes = gameResults.filter(r => r.reactionTime).map(r => r.reactionTime!)
    const avgReactionTime = reactionTimes.length > 0 
      ? (reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length).toFixed(0)
      : 'N/A'

    return [
      game.name,
      game.category,
      gameResults.length.toString(),
      (totalScore / gameResults.length).toFixed(2),
      (totalAccuracy / gameResults.length).toFixed(2),
      avgReactionTime
    ]
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

export function downloadGameSummaryCSV(data: ExportData, filename: string = 'game-summary-report.csv'): void {
  const csv = generateGameSummaryCSV(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Generate CSV for a specific test with all student data
export function generateTestWiseCSV(data: ExportData, gameId: string): string {
  const { students, results } = data
  const game = GAMES.find(g => g.id === gameId)
  const gameResults = results.filter(r => r.gameId === gameId)
  
  const headers = [
    'Student Email',
    'Student Name',
    'Roll Number',
    'Date of Birth',
    'Consent Date',
    'Test Completed',
    'Score',
    'Accuracy (%)',
    'Reaction Time (ms)',
    'Error Count',
    'Error Rate (%)',
    'Completion Date'
  ]

  // Sort students by roll number (last 3 digits ascending)
  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents
    .map(student => {
      const studentResult = gameResults.find(r => r.userId === student.id)
      
      if (!studentResult) {
        return [
          student.email,
          student.name || 'N/A',
          student.rollNo || 'N/A',
          student.dob || 'N/A',
          student.consentDate || 'N/A',
          'No',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A',
          'N/A'
        ]
      }

      return [
        student.email,
        student.name || 'N/A',
        student.rollNo || 'N/A',
        student.dob || 'N/A',
        student.consentDate || 'N/A',
        'Yes',
        studentResult.score.toFixed(2),
        studentResult.accuracy.toFixed(2),
        studentResult.reactionTime?.toFixed(0) || 'N/A',
        studentResult.errorCount?.toString() || 'N/A',
        studentResult.errorRate?.toFixed(2) || 'N/A',
        new Date(studentResult.timestamp).toLocaleString()
      ]
    })

  const csvContent = [
    `Test: ${game?.name || 'Unknown'}`,
    `Category: ${game?.category || 'Unknown'}`,
    `Total Students: ${students.filter(s => s.role === 'student').length}`,
    `Students Completed: ${gameResults.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

// Generate completion summary data
export interface CompletionStats {
  totalStudents: number
  totalTests: number
  testCompletionStats: {
    gameId: string
    gameName: string
    studentsCompleted: number
    completionRate: number
    studentList: { email: string; name: string; rollNo: string; completed: boolean }[]
  }[]
  studentsCompletedAll: {
    email: string
    name: string
    rollNo: string
    completedTests: number
    completedTestNames: string[]
  }[]
  studentsIncomplete: {
    email: string
    name: string
    rollNo: string
    completedTests: number
    completedTestNames: string[]
    missingTests: string[]
  }[]
}

export function generateCompletionStats(data: ExportData): CompletionStats {
  const { students, results } = data
  const studentList = students.filter(s => s.role === 'student')
  const totalTests = GAMES.length

  // Per-test completion stats
  const testCompletionStats = GAMES.map(game => {
    const gameResults = results.filter(r => r.gameId === game.id)
    const completedStudentIds = new Set(gameResults.map(r => r.userId))
    
    // Sort students by roll number (last 3 digits ascending)
    const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))
    const studentList = sortedStudents.map(student => ({
      email: student.email,
      name: student.name || 'N/A',
      rollNo: student.rollNo || 'N/A',
      completed: completedStudentIds.has(student.id)
    }))

    return {
      gameId: game.id,
      gameName: game.name,
      studentsCompleted: completedStudentIds.size,
      completionRate: studentList.length > 0 ? (completedStudentIds.size / studentList.length) * 100 : 0,
      studentList
    }
  })

  // Per-student completion tracking
  const studentCompletionMap = studentList.map(student => {
    const studentResults = results.filter(r => r.userId === student.id)
    const completedGameIds = new Set(studentResults.map(r => r.gameId))
    const completedTestNames = GAMES
      .filter(g => completedGameIds.has(g.id))
      .map(g => g.name)
    const missingTests = GAMES
      .filter(g => !completedGameIds.has(g.id))
      .map(g => g.name)

    return {
      email: student.email,
      name: student.name || 'N/A',
      rollNo: student.rollNo || 'N/A',
      completedTests: completedGameIds.size,
      completedTestNames,
      missingTests
    }
  })

  // Sort by roll number (last 3 digits ascending)
  const studentsCompletedAll = sortByRollNo(studentCompletionMap.filter(s => s.completedTests === totalTests))
  const studentsIncomplete = sortByRollNo(studentCompletionMap.filter(s => s.completedTests < totalTests))

  return {
    totalStudents: studentList.length,
    totalTests,
    testCompletionStats,
    studentsCompletedAll,
    studentsIncomplete
  }
}

// Generate completion summary CSV
export function generateCompletionSummaryCSV(data: ExportData): string {
  const stats = generateCompletionStats(data)
  
  const lines: string[] = [
    '=== TEST COMPLETION SUMMARY ===',
    `Total Students: ${stats.totalStudents}`,
    `Total Tests: ${stats.totalTests}`,
    `Students Completed All Tests: ${stats.studentsCompletedAll.length}`,
    `Students with Incomplete Tests: ${stats.studentsIncomplete.length}`,
    '',
    '=== PER-TEST COMPLETION ===',
    'Test Name,Students Completed,Completion Rate (%)'
  ]

  stats.testCompletionStats.forEach(test => {
    lines.push(`"${test.gameName}",${test.studentsCompleted},${test.completionRate.toFixed(1)}`)
  })

  lines.push('')
  lines.push('=== STUDENTS WHO COMPLETED ALL TESTS ===')
  lines.push('Email,Name,Roll Number,Tests Completed')
  
  stats.studentsCompletedAll.forEach(student => {
    lines.push(`"${student.email}","${student.name}","${student.rollNo}",${student.completedTests}`)
  })

  lines.push('')
  lines.push('=== STUDENTS WITH INCOMPLETE TESTS ===')
  lines.push('Email,Name,Roll Number,Tests Completed,Missing Tests')
  
  stats.studentsIncomplete.forEach(student => {
    lines.push(`"${student.email}","${student.name}","${student.rollNo}",${student.completedTests},"${student.missingTests.join('; ')}"`)
  })

  return lines.join('\n')
}

export function downloadCompletionSummaryCSV(data: ExportData, filename: string = 'completion-summary.csv'): void {
  const csv = generateCompletionSummaryCSV(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Download all test-wise CSVs as separate files (downloads as ZIP)
export async function downloadTestWiseReports(data: ExportData): Promise<void> {
  // Dynamic import JSZip for bundling efficiency
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  
  // Add a CSV for each test
  GAMES.forEach(game => {
    const csv = generateTestWiseCSV(data, game.id)
    const filename = `${game.name.replace(/[^a-zA-Z0-9]/g, '-')}-results.csv`
    zip.file(filename, csv)
  })

  // Add completion summary
  const completionSummary = generateCompletionSummaryCSV(data)
  zip.file('completion-summary.csv', completionSummary)

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `test-wise-reports-${new Date().toISOString().split('T')[0]}.zip`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Generate specialized Stroop Test CSV with detailed metrics
export function generateStroopDetailedCSV(data: ExportData): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const stroopResults = results.filter(r => r.gameId === 'stroop' && studentIds.has(r.userId))
  
  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'Congruent RT (ms)',
    'Incongruent RT (ms)',
    'Stroop Interference Effect (ms)',
    'Congruent Errors',
    'Incongruent Errors',
    'Congruent Error Rate (%)',
    'Incongruent Error Rate (%)',
    'Error Interference (%)',
    'Total Errors',
    'Error Rate (%)',
    'Accuracy (%)',
    'Overall Score',
    'Completion Date'
  ]

  // Sort students by roll number
  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents.map(student => {
    const studentResult = stroopResults.find(r => r.userId === student.id)
    
    if (!studentResult) {
      return [
        student.rollNo || 'N/A',
        student.name || 'N/A',
        student.email,
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Not Completed'
      ]
    }

    const details = studentResult.details || {}

    // Map field names from database (averageCongruentRT) or new format (congruentRT)
    const congruentRT = details.congruentRT ?? details.averageCongruentRT ?? null
    const incongruentRT = details.incongruentRT ?? details.averageIncongruentRT ?? null
    
    // Calculate stroop interference effect if not stored
    let stroopEffect = details.stroopInterferenceEffect
    if (stroopEffect === undefined && congruentRT !== null && incongruentRT !== null) {
      stroopEffect = incongruentRT - congruentRT
    }
    
    // Calculate errors from accuracy if not directly available
    const congruentTrials = details.congruentTrials || 48
    const incongruentTrials = details.incongruentTrials || 48
    const congruentErrors = details.congruentErrors ??
      (details.congruentAccuracy !== undefined ? Math.round(congruentTrials * (1 - details.congruentAccuracy)) : null)
    const incongruentErrors = details.incongruentErrors ??
      (details.incongruentAccuracy !== undefined ? Math.round(incongruentTrials * (1 - details.incongruentAccuracy)) : null)

    // Error rates (%) per condition - use stored value, else derive from error counts
    const congruentErrorRate = details.congruentErrorRate ??
      (congruentErrors !== null && congruentTrials > 0 ? (congruentErrors / congruentTrials) * 100 : null)
    const incongruentErrorRate = details.incongruentErrorRate ??
      (incongruentErrors !== null && incongruentTrials > 0 ? (incongruentErrors / incongruentTrials) * 100 : null)
    // Error Interference: Error%(incongruent) - Error%(congruent)
    let errorInterference = details.errorInterference
    if (errorInterference === undefined && congruentErrorRate !== null && incongruentErrorRate !== null) {
      errorInterference = incongruentErrorRate - congruentErrorRate
    }

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      congruentRT !== null ? congruentRT.toFixed(2) : 'N/A',
      incongruentRT !== null ? incongruentRT.toFixed(2) : 'N/A',
      stroopEffect !== null && stroopEffect !== undefined ? stroopEffect.toFixed(2) : 'N/A',
      congruentErrors !== null ? congruentErrors.toString() : 'N/A',
      incongruentErrors !== null ? incongruentErrors.toString() : 'N/A',
      congruentErrorRate !== null ? congruentErrorRate.toFixed(2) : 'N/A',
      incongruentErrorRate !== null ? incongruentErrorRate.toFixed(2) : 'N/A',
      errorInterference !== null && errorInterference !== undefined ? errorInterference.toFixed(2) : 'N/A',
      details.totalErrors?.toString() || studentResult.errorCount?.toString() || 'N/A',
      studentResult.errorRate?.toFixed(2) || 'N/A',
      studentResult.accuracy?.toFixed(2) || 'N/A',
      studentResult.score?.toString() || 'N/A',
      new Date(studentResult.timestamp).toLocaleString()
    ]
  })

  const csvContent = [
    'STROOP TEST - DETAILED RESULTS',
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Students Completed: ${stroopResults.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

// Generate specialized Trail Making Test CSV with detailed metrics
export function generateTrailMakingDetailedCSV(data: ExportData): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const tmtResults = results.filter(r => r.gameId === 'trail-making' && studentIds.has(r.userId))
  
  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'TMT-A Time (s)',
    'TMT-B Time (s)',
    'B-A Difference (s)',
    'B/A Ratio',
    'TMT-A Errors',
    'TMT-B Errors',
    'Total Errors',
    'Error Rate (%)',
    'Accuracy (%)',
    'Total Time (s)',
    'Completion Date'
  ]

  // Sort students by roll number
  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  // Convert a millisecond value to a seconds string (2 dp)
  const msToSeconds = (ms: number | null | undefined): string =>
    ms !== null && ms !== undefined && !isNaN(Number(ms)) ? (Number(ms) / 1000).toFixed(2) : 'N/A'

  const rows = sortedStudents.map(student => {
    const studentResult = tmtResults.find(r => r.userId === student.id)

    if (!studentResult) {
      return [
        student.rollNo || 'N/A',
        student.name || 'N/A',
        student.email,
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Not Completed'
      ]
    }

    const details = studentResult.details || {}

    // B/A ratio: use stored value, else derive from TMT-A / TMT-B times
    const tmtAMs = details.tmtATime
    const tmtBMs = details.tmtBTime
    let baRatio = details.baRatio !== undefined ? Number(details.baRatio) : undefined
    if (baRatio === undefined && tmtAMs && tmtBMs && Number(tmtAMs) > 0) {
      baRatio = Number(tmtBMs) / Number(tmtAMs)
    }

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      msToSeconds(tmtAMs),
      msToSeconds(tmtBMs),
      msToSeconds(details.differenceScore),
      baRatio !== undefined && !isNaN(baRatio) ? baRatio.toFixed(3) : 'N/A',
      details.tmtAErrors?.toString() || 'N/A',
      details.tmtBErrors?.toString() || 'N/A',
      details.totalErrors?.toString() || studentResult.errorCount?.toString() || 'N/A',
      studentResult.errorRate?.toFixed(2) || 'N/A',
      studentResult.accuracy?.toFixed(2) || 'N/A',
      msToSeconds(studentResult.score),
      new Date(studentResult.timestamp).toLocaleString()
    ]
  })

  const csvContent = [
    'TRAIL MAKING TEST - DETAILED RESULTS',
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Students Completed: ${tmtResults.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

// Generate Forward / Backward Digit Span detailed CSV
function generateDigitSpanDetailedCSV(
  data: ExportData,
  gameId: 'digit-span-forward' | 'digit-span-backward',
  title: string
): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const dsResults = results.filter(r => r.gameId === gameId && studentIds.has(r.userId))

  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'Longest Correct Sequence',
    'Total Correct Sequences',
    'Total Incorrect Sequences',
    'Total Trials',
    'Accuracy (%)',
    'Average Reaction Time (ms)',
    'Score',
    'Completion Date'
  ]

  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents.map(student => {
    const studentResult = dsResults.find(r => r.userId === student.id)

    if (!studentResult) {
      return [
        student.rollNo || 'N/A',
        student.name || 'N/A',
        student.email,
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Not Completed'
      ]
    }

    const details = studentResult.details || {}
    const totalTrials = details.totalTrials ?? null
    const correctSequences = details.correctSequences ?? null
    const incorrectSequences = (totalTrials !== null && correctSequences !== null)
      ? totalTrials - correctSequences
      : null
    const longestCorrect = details.maxSpan ?? details.longestCorrectSequence ?? null

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      longestCorrect !== null ? longestCorrect.toString() : 'N/A',
      correctSequences !== null ? correctSequences.toString() : 'N/A',
      incorrectSequences !== null ? incorrectSequences.toString() : 'N/A',
      totalTrials !== null ? totalTrials.toString() : 'N/A',
      studentResult.accuracy?.toFixed(2) || 'N/A',
      studentResult.reactionTime?.toFixed(0) || 'N/A',
      studentResult.score?.toString() || 'N/A',
      new Date(studentResult.timestamp).toLocaleString()
    ]
  })

  return [
    `${title} - DETAILED RESULTS`,
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Students Completed: ${dsResults.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

export function generateForwardDigitSpanDetailedCSV(data: ExportData): string {
  return generateDigitSpanDetailedCSV(data, 'digit-span-forward', 'FORWARD DIGIT SPAN TEST')
}

export function generateBackwardDigitSpanDetailedCSV(data: ExportData): string {
  return generateDigitSpanDetailedCSV(data, 'digit-span-backward', 'BACKWARD DIGIT SPAN TEST')
}

// Generate combined Digit Span CSV joining each student's Forward + Backward results
export function generateDigitSpanCombinedDetailedCSV(data: ExportData): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const forwardResults = results.filter(r => r.gameId === 'digit-span-forward' && studentIds.has(r.userId))
  const backwardResults = results.filter(r => r.gameId === 'digit-span-backward' && studentIds.has(r.userId))

  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'Forward Span Score',
    'Backward Span Score',
    'Total Score (Forward + Backward)',
    'Forward Correct Sequences',
    'Backward Correct Sequences',
    'Forward Completed',
    'Backward Completed',
    'Completion Date'
  ]

  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  // Extract the span score (longest correct sequence) from a digit span result
  const spanOf = (result?: GameResult): number | null => {
    if (!result) return null
    const details = result.details || {}
    return details.maxSpan ?? details.longestCorrectSequence ?? result.score ?? null
  }
  const correctSeqOf = (result?: GameResult): number | null => {
    if (!result) return null
    return result.details?.correctSequences ?? null
  }

  const rows = sortedStudents.map(student => {
    const forward = forwardResults.find(r => r.userId === student.id)
    const backward = backwardResults.find(r => r.userId === student.id)

    const forwardSpan = spanOf(forward)
    const backwardSpan = spanOf(backward)
    // Total Score = Forward + Backward combined (only when both tests are completed)
    const totalScore = (forwardSpan !== null && backwardSpan !== null)
      ? forwardSpan + backwardSpan
      : null

    const latestTimestamp = [forward?.timestamp, backward?.timestamp]
      .filter((t): t is number => typeof t === 'number')
      .reduce((max, t) => Math.max(max, t), 0)

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      forwardSpan !== null ? forwardSpan.toString() : 'N/A',
      backwardSpan !== null ? backwardSpan.toString() : 'N/A',
      totalScore !== null ? totalScore.toString() : 'N/A',
      correctSeqOf(forward) !== null ? correctSeqOf(forward)!.toString() : 'N/A',
      correctSeqOf(backward) !== null ? correctSeqOf(backward)!.toString() : 'N/A',
      forward ? 'Yes' : 'No',
      backward ? 'Yes' : 'No',
      latestTimestamp > 0 ? new Date(latestTimestamp).toLocaleString() : 'Not Completed'
    ]
  })

  const completedBoth = sortedStudents.filter(s =>
    forwardResults.some(r => r.userId === s.id) && backwardResults.some(r => r.userId === s.id)
  ).length

  return [
    'DIGIT SPAN (COMBINED FORWARD + BACKWARD) - DETAILED RESULTS',
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Completed Both Tests: ${completedBoth}`,
    'Note: Total Score is shown only when both Forward and Backward tests are completed.',
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

// Generate Mental Rotation Test detailed CSV
export function generateMentalRotationDetailedCSV(data: ExportData): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const mrtResults = results.filter(r => r.gameId === 'mental-rotation' && studentIds.has(r.userId))

  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'Total Questions',
    'Correct Selections',
    'Incorrect Selections',
    'Accuracy (%)',
    'Mean Reaction Time (ms)',
    'Reaction Time - Correct Only (ms)',
    'Mirror Errors',
    'Different Figure Errors',
    'Score',
    'Completion Date'
  ]

  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents.map(student => {
    const studentResult = mrtResults.find(r => r.userId === student.id)

    if (!studentResult) {
      return [
        student.rollNo || 'N/A',
        student.name || 'N/A',
        student.email,
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Not Completed'
      ]
    }

    const details = studentResult.details || {}
    const meanRT = details.meanReactionTime ?? details.avgReactionTime ?? studentResult.reactionTime ?? null
    const correctRT = details.correctReactionTime ?? null

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      details.totalQuestions?.toString() || 'N/A',
      details.correctSelections?.toString() || 'N/A',
      details.incorrectSelections?.toString() || 'N/A',
      studentResult.accuracy?.toFixed(2) || 'N/A',
      meanRT !== null ? Number(meanRT).toFixed(0) : 'N/A',
      correctRT !== null ? Number(correctRT).toFixed(0) : 'N/A',
      details.mirrorErrors?.toString() || 'N/A',
      details.differentFigureErrors?.toString() || 'N/A',
      studentResult.score?.toString() || 'N/A',
      new Date(studentResult.timestamp).toLocaleString()
    ]
  })

  return [
    'MENTAL ROTATION TEST - DETAILED RESULTS',
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Students Completed: ${mrtResults.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

// Generate Dichotic Listening Test detailed CSV
export function generateDichoticListeningDetailedCSV(data: ExportData): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const dlResults = results.filter(r => r.gameId === 'dichotic-listening' && studentIds.has(r.userId))

  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'Right Ear Score (%)',
    'Left Ear Score (%)',
    'Right Ear Correct',
    'Left Ear Correct',
    'Ear Advantage (R - L)',
    'Total Correct',
    'Accuracy (%)',
    'Average Reaction Time (ms)',
    'Completion Date'
  ]

  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents.map(student => {
    const studentResult = dlResults.find(r => r.userId === student.id)

    if (!studentResult) {
      return [
        student.rollNo || 'N/A',
        student.name || 'N/A',
        student.email,
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Not Completed'
      ]
    }

    const details = studentResult.details || {}
    const rightCorrect = details.rightEarCorrect ?? null
    const leftCorrect = details.leftEarCorrect ?? null
    let earAdv = details.earAdvantage
    if (earAdv === undefined && rightCorrect !== null && leftCorrect !== null) {
      earAdv = rightCorrect - leftCorrect
    }

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      details.rightEarScore !== undefined ? Number(details.rightEarScore).toFixed(2) : 'N/A',
      details.leftEarScore !== undefined ? Number(details.leftEarScore).toFixed(2) : 'N/A',
      rightCorrect !== null ? rightCorrect.toString() : 'N/A',
      leftCorrect !== null ? leftCorrect.toString() : 'N/A',
      earAdv !== undefined && earAdv !== null ? Number(earAdv).toFixed(2) : 'N/A',
      details.totalCorrect?.toString() || 'N/A',
      studentResult.accuracy?.toFixed(2) || 'N/A',
      studentResult.reactionTime?.toFixed(0) || 'N/A',
      new Date(studentResult.timestamp).toLocaleString()
    ]
  })

  return [
    'DICHOTIC LISTENING TEST - DETAILED RESULTS',
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Students Completed: ${dlResults.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

// Helper: classify EHI laterality quotient using Edinburgh Handedness Inventory ranges
function classifyLQ(lq: number): string {
  if (lq === 100) return 'Strong RH'
  if (lq >= 40) return 'Moderate RH'
  if (lq >= -39) return 'Mixed Handed'
  if (lq > -100) return 'Moderate LH'
  return 'Strong LH'
}

// Generate Edinburgh Handedness Inventory detailed CSV
export function generateHandednessDetailedCSV(data: ExportData): string {
  const { students, results } = data
  const studentIds = new Set(students.filter(s => s.role === 'student').map(s => s.id))
  const ehiResults = results.filter(r => r.gameId === 'handedness-inventory' && studentIds.has(r.userId))

  const headers = [
    'Roll Number',
    'Student Name',
    'Student Email',
    'Laterality Quotient (LQ)',
    'Classification',
    'Handedness',
    'Total Score',
    'Completion Date'
  ]

  const sortedStudents = sortStudentsByRollNo(students.filter(s => s.role === 'student'))

  const rows = sortedStudents.map(student => {
    const studentResult = ehiResults.find(r => r.userId === student.id)

    if (!studentResult) {
      return [
        student.rollNo || 'N/A',
        student.name || 'N/A',
        student.email,
        'N/A', 'N/A', 'N/A', 'N/A', 'Not Completed'
      ]
    }

    const details = studentResult.details || {}
    const lq = details.lateralityQuotient
    const classification = details.classification ?? (typeof lq === 'number' ? classifyLQ(lq) : 'N/A')

    return [
      student.rollNo || 'N/A',
      student.name || 'N/A',
      student.email,
      typeof lq === 'number' ? lq.toFixed(2) : 'N/A',
      classification || 'N/A',
      details.handedness || 'N/A',
      details.totalScore?.toString() || 'N/A',
      new Date(studentResult.timestamp).toLocaleString()
    ]
  })

  return [
    'EDINBURGH HANDEDNESS INVENTORY - DETAILED RESULTS',
    `Generated: ${new Date().toLocaleString()}`,
    `Total Students: ${sortedStudents.length}`,
    `Students Completed: ${ehiResults.length}`,
    '',
    'Classification ranges (LQ):',
    '  +100         : Strong Right-Handed',
    '  +40 to +99   : Moderate Right-Handed',
    '  -39 to +39   : Mixed Handed',
    '  -40 to -99   : Moderate Left-Handed',
    '  -100         : Strong Left-Handed',
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

// Download all 7 game-specific detailed reports as a single ZIP
export async function downloadAllGameDetailedReports(data: ExportData): Promise<void> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  zip.file('1-Stroop-Test-Detailed-Results.csv', generateStroopDetailedCSV(data))
  zip.file('2-Forward-Digit-Span-Detailed-Results.csv', generateForwardDigitSpanDetailedCSV(data))
  zip.file('3-Backward-Digit-Span-Detailed-Results.csv', generateBackwardDigitSpanDetailedCSV(data))
  zip.file('4-Digit-Span-Combined-Detailed-Results.csv', generateDigitSpanCombinedDetailedCSV(data))
  zip.file('5-Trail-Making-Test-Detailed-Results.csv', generateTrailMakingDetailedCSV(data))
  zip.file('6-Mental-Rotation-Test-Detailed-Results.csv', generateMentalRotationDetailedCSV(data))
  zip.file('7-Dichotic-Listening-Test-Detailed-Results.csv', generateDichoticListeningDetailedCSV(data))
  zip.file('8-Edinburgh-Handedness-Inventory-Detailed-Results.csv', generateHandednessDetailedCSV(data))

  const blob = await zip.generateAsync({ type: 'blob' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `all-game-detailed-reports-${new Date().toISOString().split('T')[0]}.zip`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Download specialized test reports (Stroop + Trail Making) as ZIP
export async function downloadSpecializedTestReports(data: ExportData): Promise<void> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  
  // Add Stroop Test detailed CSV
  const stroopCSV = generateStroopDetailedCSV(data)
  zip.file('Stroop-Test-Detailed-Results.csv', stroopCSV)
  
  // Add Trail Making Test detailed CSV
  const tmtCSV = generateTrailMakingDetailedCSV(data)
  zip.file('Trail-Making-Test-Detailed-Results.csv', tmtCSV)

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `specialized-test-reports-${new Date().toISOString().split('T')[0]}.zip`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
