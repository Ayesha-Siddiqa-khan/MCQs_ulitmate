import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ArrowLeft, FileText, Sparkles, ChevronRight, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useParams } from 'react-router-dom';

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

interface QuestionSet {
  id: number;
  title: string;
  questions: number;
  status: string;
}

export function MaterialDetail() {
  const { id } = useParams();

  const material = {
    id: Number(id),
    title: '9th Math MCQs (Imported)',
    type: 'PASTED',
    size: '100.5 KB',
    chars: 0,
    pages: 40,
    status: 'extracted',
    extractedText: 'No text extracted yet.'
  };

  const questionSets: QuestionSet[] = [
    { id: 1, title: 'Ch1: Matrices and Determinants', questions: 20, status: 'extract existing' },
    { id: 2, title: 'Ch2: Real and Complex Numbers', questions: 28, status: 'extract existing' },
    { id: 3, title: 'Ch3: Logarithms', questions: 23, status: 'extract existing' },
    { id: 4, title: 'Ch4: Algebraic Expressions and Algebraic Formulas', questions: 20, status: 'extract existing' }
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Back Button */}
      <motion.div variants={itemVariants}>
        <Link to="/materials">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Materials
          </Button>
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3">
            {material.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-1 rounded bg-muted">{material.type}</span>
            <span>•</span>
            <span>{material.chars} chars</span>
            <span>•</span>
            <span>{material.pages} pages</span>
          </div>
        </div>
        <Badge className="bg-green-500">
          {material.status}
        </Badge>
      </motion.div>

      {/* Action Buttons */}
      <motion.div variants={itemVariants} className="flex gap-3">
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Extract solved MCQs
        </Button>
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate MCQs
        </Button>
      </motion.div>

      <Separator />

      {/* Extracted Text Section */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Extracted text</CardTitle>
            <CardDescription>
              This is what we will feed to the AI when you generate questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-6 text-sm text-muted-foreground">
              {material.extractedText}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Question Sets */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Question sets from this material
            </CardTitle>
            <CardDescription>
              Practice these question sets to master the material
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {questionSets.map((set) => (
              <div
                key={set.id}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-accent transition-colors cursor-pointer group border border-transparent hover:border-primary/20"
              >
                <div className="flex-1">
                  <h4 className="font-medium group-hover:text-primary transition-colors">
                    {set.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {set.questions} questions
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{set.status}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Open
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
