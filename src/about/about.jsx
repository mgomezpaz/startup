import React from 'react';
import './about.css';

export function About() {
  return (
    <main>
      <div id="picture" className="picture-box">
        <img src="placeholder.jpg" alt="AI Code Analysis" />
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
        <div>"There's no silver bullet with cybersecurity; a layered defense is the only viable option."</div>
        <div>James Scott</div>
      </div>
    </main>
  );
}