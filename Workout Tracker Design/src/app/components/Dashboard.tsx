import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  BookOpen,
  TrendingUp,
  AlertCircle,
  Award,
  Upload,
  Sparkles,
  FileText,
  ChevronRight,
  Info,
  BarChart3,
  Target,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function Dashboard() {
  const stats = [
    { label: 'Quizzes taken', value: '10', icon: BookOpen, color: 'text-blue-500' },
    { label: 'Knowledge score', value: '18%', icon: TrendingUp, color: 'text-green-500' },
    { label: 'Open mistakes', value: '0', icon: AlertCircle, color: 'text-orange-500' },
    { label: 'Mastered', value: '0', icon: Award, color: 'text-purple-500' }
  ];

  const recentUploads = [
    { id: 1, title: '9th Math MCQs Imported', date: '2 days ago', type: 'PASTED' },
    { id: 2, title: 'nath', date: '3 days ago', type: 'PDF' },
    { id: 3, title: 'CS', date: '5 days ago', type: 'PDF' }
  ];

  const recentAttempts = [
    { id: 1, title: 'Ch6: Algebraic Manipulation', date: '12/2, 20%', score: 20 },
    { id: 2, title: 'Ch6: Algebraic Manipulation', date: '12/2, 40%', score: 40 },
    { id: 3, title: 'Ch6: Algebraic Manipulation', date: '12/1, 60%', score: 60 },
    { id: 4, title: 'Ch6: Algebraic Manipulation', date: '12/1, 20%', score: 20 },
    { id: 5, title: 'Ch6: Algebraic Manipulation', date: '11/29, 20%', score: 20 }
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Alert Banner */}
      <motion.div variants={itemVariants}>
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/10 to-transparent">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <CardTitle className="text-lg">Add an AI key</CardTitle>
                <CardDescription className="text-sm">
                  You haven't added an AI key yet. OpenAI, Anthropic or Google — pick one on the settings page. Your key is encrypted at rest and never leaves your account.
                </CardDescription>
                <Link to="/settings">
                  <Button variant="outline" size="sm" className="mt-3">
                    Go to Settings
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Get Started */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Get started
              </CardTitle>
              <CardDescription>Three quick steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                  1
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium group-hover:text-blue-500 transition-colors">Add study material</h4>
                    <Link to="/materials">
                      <Button variant="ghost" size="sm">
                        Add material
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Upload a PDF/DOCX or paste text. It is saved to your private folder.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
                  2
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium group-hover:text-purple-500 transition-colors">Generate questions</h4>
                    <Link to="/materials">
                      <Button variant="ghost" size="sm">
                        Browse materials
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Browse and generate MCQs using your AI provider.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                  3
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium group-hover:text-green-500 transition-colors">Practice your mistakes</h4>
                    <Link to="/mistakes">
                      <Button variant="ghost" size="sm">
                        View mistakes
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pick a mistake set you got wrong. Mastery updates as you improve.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recommended Practice */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Recommended practice
              </CardTitle>
              <CardDescription>Suggested practice sessions based on your open mistakes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-center">
                <div className="space-y-2">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    No recommendations yet. Take a quiz first.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Uploads */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-500" />
                Recent uploads
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentUploads.map((upload) => (
                <Link to={`/materials/${upload.id}`} key={upload.id}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{upload.title}</p>
                        <p className="text-xs text-muted-foreground">{upload.date}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Attempts */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                Recent attempts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentAttempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                  <div className="flex-1">
                    <p className="font-medium group-hover:text-primary transition-colors">{attempt.title}</p>
                    <p className="text-xs text-muted-foreground">{attempt.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <Progress value={attempt.score} className="h-2" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
