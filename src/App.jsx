import React, { useState } from 'react';
import './App.css';
import Hero from './components/Hero';
import Features from './components/Features';
import Agents from './components/Agents';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="app">
      <Hero />
      <Features />
      <Agents />
      <Footer />
    </div>
  );
}
