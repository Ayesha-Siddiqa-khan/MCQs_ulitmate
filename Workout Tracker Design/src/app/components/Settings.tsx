import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Settings as SettingsIcon, Key, Trash2, Eye, EyeOff, Sparkles, Database, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from './ui/badge';

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

export function Settings() {
  const [apiKey, setApiKey] = useState('sk-... / sk-ant-... / AIza...');
  const [showApiKey, setShowApiKey] = useState(false);
  const [provider, setProvider] = useState('OpenAI');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="flex items-center gap-2">
          <SettingsIcon className="h-7 w-7" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your AI provider. Your key is encrypted at rest and only used to generate questions for you.
        </p>
      </motion.div>

      {/* AI Provider Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <CardTitle>AI provider</CardTitle>
                <CardDescription>
                  We support OpenAI, Anthropic, and Google. Pick one and paste your key. You can replace or remove it at any time.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Warning Badge */}
            <div className="rounded-lg border-2 border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-transparent p-4">
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-orange-500 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-medium">No key saved</h4>
                  <p className="text-sm text-muted-foreground">
                    You can still read your materials and review past attempts, but you won't be able to generate new questions until you add a key.
                  </p>
                </div>
              </div>
            </div>

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OpenAI">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      OpenAI
                    </div>
                  </SelectItem>
                  <SelectItem value="Anthropic">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      Anthropic
                    </div>
                  </SelectItem>
                  <SelectItem value="Google">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🌟</span>
                      Google
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <Label>API key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Stored encrypted with Fernet. Never logged.
              </p>
            </div>

            {/* Save Button */}
            <Button className="w-full gap-2">
              <Key className="h-4 w-4" />
              Save key
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Student Data Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-2 border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/10 p-2">
                <Database className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-destructive">Student data</CardTitle>
                <CardDescription>
                  Clear old uploaded materials, generated question sets, quiz attempts, and mistake history for this signed-in student.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="text-muted-foreground">
                Remove this student's materials, extracted questions, quiz attempts, practice sessions, and mistake history. The account and AI key stay in place.
              </p>
            </div>

            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete old study data
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Cards */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Your API key is encrypted using Fernet encryption</p>
            <p>• Keys are only used to generate questions</p>
            <p>• We never log or share your keys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supported Providers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">OpenAI GPT-4</Badge>
            <Badge variant="secondary">Anthropic Claude</Badge>
            <Badge variant="secondary">Google Gemini</Badge>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
