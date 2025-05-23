import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import MarkdownPage from './MarkdownPage.tsx'; // Import the MarkdownPage component
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router basename="/barbated"> {/* Set the basename here */}
      <Routes>
        <Route path="/" element={<App />} />
        {/* Route for any .md file at the root of public */}
        <Route path="/:mdfile.md" element={<MarkdownPage />} /> 
      </Routes>
    </Router>
  </React.StrictMode>,
);
