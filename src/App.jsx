import React, { useState } from 'react';
import './App.css';
import Hero from './components/Hero';
import Features from './components/Features';
import Promo from './components/Promo';
import Agents from './components/Agents';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="app">
      <Hero />
      <Features />
      <Promo />
      <Agents />
      <Footer />
    </div>
  );
}
