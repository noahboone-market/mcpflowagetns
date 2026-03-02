import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#agents">Agents</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              <li><a href="#docs">Documentation</a></li>
              <li><a href="#blog">Blog</a></li>
              <li><a href="#api">API</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Community</h4>
            <ul>
              <li><a href="#github">GitHub</a></li>
              <li><a href="#discord">Discord</a></li>
              <li><a href="#twitter">Twitter</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="#privacy">Privacy</a></li>
              <li><a href="#terms">Terms</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-divider"></div>

        <div className="footer-bottom">
          <p>&copy; 2026 MCP Flow Agents. All rights reserved.</p>
          <div className="social-links">
            <a href="#github">GitHub</a>
            <a href="#twitter">Twitter</a>
            <a href="#discord">Discord</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
