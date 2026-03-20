import Prism from 'prismjs';

// Import theme CSS
import 'prismjs/themes/prism-tomorrow.min.css';

// Import languages
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';

// Attach to window for backward compatibility with any legacy code
(window as any).Prism = Prism;

export default Prism;
