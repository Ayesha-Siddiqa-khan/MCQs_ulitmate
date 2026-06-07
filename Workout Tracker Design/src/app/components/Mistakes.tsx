import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, TrendingUp, Target, Award, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

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
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

interface MistakeCategory {
  title: string;
  count: number;
  color: string;
  icon: any;
  description: string;
}

export function Mistakes() {
  const categories: MistakeCategory[] = [
    {
      title: 'NEW MISTAKE',
      count: 0,
      color: 'from-red-500/20 to-red-500/5 border-red-500/50',
      icon: AlertCircle,
      description: 'Recently incorrect questions'
    },
    {
      title: 'NEEDS PRACTICE',
      count: 0,
      color: 'from-orange-500/20 to-orange-500/5 border-orange-500/50',
      icon: AlertTriangle,
      description: 'Questions you struggle with'
    },
    {
      title: 'IMPROVING',
      count: 0,
      color: 'from-blue-500/20 to-blue-500/5 border-blue-500/50',
      icon: TrendingUp,
      description: 'Making progress on these'
    },
    {
      title: 'MASTERED',
      count: 0,
      color: 'from-green-500/20 to-green-500/5 border-green-500/50',
      icon: Award,
      description: 'You\'ve got these down!'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2">
          <Target className="h-7 w-7" />
          Mistakes
        </h1>
        <p className="text-muted-foreground">
          Wrong answers land here. Mastery updates as you get them right.
        </p>
      </div>

      {/* Mistake Categories */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {categories.map((category) => (
          <motion.div key={category.title} variants={itemVariants}>
            <Card className={`border-2 bg-gradient-to-br ${category.color} hover:scale-105 transition-transform cursor-pointer`}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <category.icon className="h-6 w-6" />
                  <div className="text-3xl">{category.count}</div>
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm uppercase tracking-wide">
                    {category.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {category.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Target className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl mb-2">No mistakes yet</h3>
            <p className="text-muted-foreground max-w-md">
              Take a quiz first. Wrong answers will show up here automatically.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
