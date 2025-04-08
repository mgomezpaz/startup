import React from 'react';
import './about.css';

export function About() {
  const [imageUrl, setImageUrl] = React.useState('');
  const [quote, setQuote] = React.useState('Loading...');
  const [quoteAuthor, setQuoteAuthor] = React.useState('unknown');

  React.useEffect(() => {
    setImageUrl('placeholder.jpg');
  
    const securityQuotes = [
      { 
        text: "There's no silver bullet with cybersecurity; a layered defense is the only viable option.",
        author: "James Scott"
      },
      { 
        text: "Security isn't something you buy, it's something you do.",
        author: "Bruce Schneier"
      },
      { 
        text: "The only truly secure system is one that is powered off, cast in a block of concrete and sealed in a lead-lined room.",
        author: "Gene Spafford"
      }
    ];
    
    const randomQuote = securityQuotes[Math.floor(Math.random() * securityQuotes.length)];
    setQuote(randomQuote.text);
    setQuoteAuthor(randomQuote.author);
  }, []);

  return (
    <main>
      <div id="picture" className="picture-box">
        <img src={imageUrl} alt="AI Code Analysis" />
      </div>

      <p>
        Free Secure Code is a web application that allows developers to identify and resolve security vulnerabilities 
        in their code quickly and efficiently. By leveraging the power of AI through the OpenAI GPT API, we provide 
        detailed analysis and actionable recommendations to improve code security.
      </p>

      <p>
        Whether you're working on a small project or a large-scale application, our tool ensures your code meets 
        high-security standards. Simply upload your code, and let our AI-powered system do the heavy lifting.
      </p>

      <div id="quote">
        <div>{quote}</div>
        <div>{quoteAuthor}</div>
      </div>
    </main>
  );
}