import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { FileText, Plus, Search, Upload, ChevronRight, File } from 'lucide-react';
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
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

interface Material {
  id: number;
  title: string;
  type: 'PDF' | 'PASTED' | 'DOCX';
  size: string;
  status: 'extracted' | 'uploaded' | 'processing';
  date: string;
  questionSets?: number;
}

export function Materials() {
  const [searchQuery, setSearchQuery] = useState('');

  const materials: Material[] = [
    {
      id: 1,
      title: '9th Math MCQs (Imported)',
      type: 'PASTED',
      size: '100.5 KB',
      status: 'extracted',
      date: '2 days ago',
      questionSets: 4
    },
    {
      id: 2,
      title: 'nath',
      type: 'PDF',
      size: '100.5 KB',
      status: 'uploaded',
      date: '3 days ago',
      questionSets: 0
    },
    {
      id: 3,
      title: 'CS',
      type: 'PDF',
      size: '82.3 KB',
      status: 'extracted',
      date: '5 days ago',
      questionSets: 6
    }
  ];

  const filteredMaterials = materials.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'extracted':
        return 'bg-green-500';
      case 'uploaded':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return '📄';
      case 'PASTED':
        return '📋';
      case 'DOCX':
        return '📝';
      default:
        return '📄';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Materials
          </h1>
          <p className="text-muted-foreground">
            Upload study material or paste text. You can generate questions from any of these.
          </p>
        </div>
        <Button size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search materials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Materials Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredMaterials.map((material) => (
          <motion.div key={material.id} variants={itemVariants}>
            <Link to={`/materials/${material.id}`}>
              <Card className="group h-full hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-2xl">
                      {getTypeIcon(material.type)}
                    </div>
                    <Badge className={getStatusColor(material.status)}>
                      {material.status}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
                      {material.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-muted">{material.type}</span>
                      <span>{material.size}</span>
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{material.date}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>

                  {material.questionSets !== undefined && material.questionSets > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-accent p-2 text-sm">
                      <File className="h-4 w-4 text-primary" />
                      <span>{material.questionSets} question set{material.questionSets > 1 ? 's' : ''} generated</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {filteredMaterials.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Upload className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl mb-2">No materials found</h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery ? 'Try a different search term' : 'Upload your first study material to get started'}
          </p>
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Material
          </Button>
        </div>
      )}
    </div>
  );
}
