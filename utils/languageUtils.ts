const LANGUAGE_EXTENSIONS: Record<string, string> = {
  'go': 'go',
  'py': 'python',
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'c',
  'cs': 'csharp',
  'rs': 'rust',
  'rb': 'ruby',
  'php': 'php',
};

export const detectLanguage = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return LANGUAGE_EXTENSIONS[ext || ''] || 'unknown';
};
