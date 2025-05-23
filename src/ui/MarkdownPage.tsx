import React, { useState, useEffect } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug'; // Import rehype-slug
import { useParams } from 'react-router-dom';

const MarkdownPage: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const { mdfile } = useParams<{ mdfile?: string }>();

  useEffect(() => {
    if (mdfile) {
      import(`../assets/manuals/${mdfile}.md?raw`)
        .then(module => {
          setMarkdown(module.default);
        })
        .catch(error => {
          console.error("Error importing markdown:", error);
          setMarkdown(`# Error loading content\n\nCould not load: \`${mdfile}.md\`\n\nDetails: ${error.message}`);
        });
    } else {
      setMarkdown("# Error: Markdown file name not specified in URL.");
    }
  }, [mdfile]);

  const customRenderers: Components = {
    a: ({ node, href, children, ...props }) => {
      if (href && href.startsWith('#')) {
        return (
          <a
            href={href} // Keep the href for context, though we preventDefault
            onClick={(e) => {
              e.preventDefault();
              const targetId = href.substring(1);
              const targetElement = document.getElementById(targetId);
              if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
              } else {
                console.warn(`Target element with ID '${targetId}' not found. Ensure headings have corresponding IDs.`);
              }
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    }
  };

  return (
    <div className="markdown-container" style={{ padding: '20px', maxWidth: '800px', fontFamily: 'sans-serif', lineHeight: '1.6' }}>
      {/* Add rehypeSlug to rehypePlugins array */}
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeSlug]} // Added rehypeSlug here
        components={customRenderers}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPage;
