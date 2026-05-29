import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import styles from './MarkdownRenderer.module.css';

interface MarkdownRendererProps {
    content: string;
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

const isSafeHref = (href: string | undefined): boolean => {
    if (!href) return false;
    const lower = href.toLowerCase();
    return !lower.startsWith('javascript:') &&
           !lower.startsWith('data:') &&
           !lower.startsWith('vbscript:');
};

const sanitizeHref = (href: string | undefined): string => {
    if (!href) return '#';
    if (!isSafeHref(href)) return '#';
    return href;
};

/**
 * Renders Markdown content with interactive links and symbols for the Synthesis Panel.
 * All content is sanitized via DOMPurify to prevent XSS attacks.
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onLinkClick, onSymbolClick }) => {
    const sanitizedContent = useMemo(() => {
        return DOMPurify.sanitize(content, {
            ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                           'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre',
                           'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
            ALLOWED_ATTR: ['href', 'title', 'class'],
            FORBID_SCRIPTS: true,
            ADD_ATTR: ['target'],
        });
    }, [content]);

    return (
        <div className={styles.markdownContainer}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Override Link Handling with sanitized href
                    a: ({ node, href, children, ...props }) => {
                        const safeHref = sanitizeHref(href);

                        const handleClick = (e: React.MouseEvent) => {
                            if (safeHref !== '#' && onLinkClick) {
                                e.preventDefault();
                                onLinkClick(safeHref);
                            }
                        };

                        return (
                            <a
                                href={safeHref}
                                className={styles.link}
                                onClick={handleClick}
                                title={href}
                                target="_blank"
                                rel="noopener noreferrer"
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
                {sanitizedContent}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
