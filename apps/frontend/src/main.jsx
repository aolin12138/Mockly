import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './component/page/Home';
import Login from './component/page/Login';
import Register from './component/page/Register';
import Profile from './component/page/Profile';
import Dashboard from './component/page/Dashboard';
import App from './App';
import TechnicalInterviewPage from './component/page/TechnicalInterviewPage';
import BehavioralInterviewPage from './component/page/BehaviouralInterviewPage';
import ResultsPage from './component/page/ResultsPage';
import TechnicalResultsPage from './component/page/ResultsTechnicalPage';
import { ThemeProvider } from './context/ThemeContext';

import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element with id 'root'");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/login' element={<Login />} />
          <Route path='/register' element={<Register />} />
          <Route path='/profile' element={<Profile />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/setup' element={<App />} />
          <Route path='/technical' element={<TechnicalInterviewPage />} />
          <Route path='/behavioural' element={<BehavioralInterviewPage />} />
          <Route path='/results' element={<ResultsPage />} />
          <Route path='/results-technical' element={<TechnicalResultsPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  </React.StrictMode>
);
