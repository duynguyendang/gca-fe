import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownRenderer.module.css';

interface MarkdownRendererProps {
    content: string;
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

/**
 * Renders Markdown content with interactive links and symbols for the Synthesis Panel.
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onLinkClick, onSymbolClick }) => {
    return (
        <div className={styles.markdownContainer}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Override Link Handling
                    a: ({ node, href, children, ...props }) => {
                        const isInternal = href?.startsWith('/') || href?.startsWith('[') || href?.match(/\.[a-z]+$/i);

                        const handleClick = (e: React.MouseEvent) => {
                            if (href && onLinkClick) {
                                e.preventDefault();
                                onLinkClick(href);
                            }
                        };

                        return (
                            <a
                                href={href}
                                className={styles.link}
                                onClick={handleClick}
                                title={href}
                                {...props}
                            >
                                {children}
                            </a>
                        );
                    },
                    // Override Code (Symbol) Handling
                    code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const text = String(children).replace(/\n$/, '');

                        // If it's inline code, treat as potential symbol
                        if (inline) {
                            const handleSymbolClick = () => {
                                if (onSymbolClick) {
                                    onSymbolClick(text);
                                }
                            };
                            return (
                                <code className={styles.code} onClick={handleSymbolClick} {...props}>
                                    {children}
                                </code>
                            );
                        }

                        // Block code (keep default simple styling for now)
                        return (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
