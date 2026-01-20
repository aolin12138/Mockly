import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import App from './App';
import TechnicalInterviewPage from './component/page/TechnicalInterviewPage';
import BehavioralInterviewPage from './component/page/BehaviouralInterviewPage';
import ResultsPage from './component/page/ResultsPage';
import TechnicalResultsPage from './component/page/ResultsTechnicalPage';

import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element with id 'root'");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path='/' element={<App />} />
        <Route path='/technical' element={<TechnicalInterviewPage />} />
        <Route path='/behavioural' element={<BehavioralInterviewPage />} />
        <Route path='/results' element={<ResultsPage />} />
        <Route path='/results-technical' element={<TechnicalResultsPage />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
