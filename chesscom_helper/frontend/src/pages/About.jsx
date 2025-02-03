import React from "react";
import { Container, Typography, Box, Link } from "@mui/material";

const About = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4, textAlign: "left" }}>
        <Typography variant="h4" gutterBottom>
          About Chesscom Helper{" "}
          <Box component="img" 
              src="/assets/majestic-knight.png" 
              alt="Majestic Horsey" 
              sx={{ width: 40, height: 40, verticalAlign: "middle", ml: 1 }} />
        </Typography>
        <Typography variant="body1" paragraph>
          This web app is a fun and flouncy side project.
        </Typography>
        <Typography variant="body1" paragraph>
          Chess.com has a <i>very</i>{" "}
          <Link href="https://www.chess.com/news/view/published-data-api" target="_blank" rel="noopener noreferrer">
            public API
          </Link>
          , and I wanted to play with it as an excuse to learn Django, React, and Material-UI.
          My original goal was to set up an app to notify me when specific players are in live games.
          As you can see, that has not, uh, particularly been implemented yet. But it could! It will!
        </Typography>
        <Typography variant="body1" paragraph>
          If you have any questions, feedback, or just want to chat about the project, 
          feel free to reach out!
        </Typography>

        {/* Links with Custom SVG Icons */}
        <Box sx={{ mt: 3 }}>
          <Link
            href="https://github.com/emily-flambe/chesscom-helper"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: "inline-flex", alignItems: "center", mx: 1 }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="currentColor" 
              style={{ marginRight: 4 }}>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.4.6.1.82-.26.82-.58 0-.28-.01-1.02-.02-2-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.32-1.75-1.32-1.75-1.08-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.06 1.82 2.78 1.3 3.46.99.1-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.23-3.24-.12-.3-.53-1.52.12-3.16 0 0 1-.32 3.3 1.24a11.42 11.42 0 016 0c2.3-1.56 3.3-1.24 3.3-1.24.65 1.64.24 2.86.12 3.16.76.84 1.23 1.92 1.23 3.24 0 4.63-2.8 5.66-5.47 5.96.43.37.81 1.1.81 2.22 0 1.6-.02 2.9-.02 3.3 0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub Repo
          </Link>
          <Link
            href="mailto:emilyflambe@gmail.com"
            sx={{ display: "inline-flex", alignItems: "center", mx: 1 }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="currentColor"
              style={{ marginRight: 4 }}>
              <path d="M22 6c0-1.1-.9-2-2-2H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/>
            </svg>
            Contact Me
          </Link>
        </Box>

        {/* Super fun bonus content */}
        <Box sx={{ mt: 30, display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <img
            src="/assets/bonus_image_1.png"
            alt="Bonus Easter Egg 1"
            style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
          />
          <Box sx={{ flexBasis: "100%", textAlign: "left" }}>
            <Typography variant="body2" sx={{ fontStyle: "italic" }}>
              I'm a what, Cursor? A WHAT?
            </Typography>
          </Box>
          <img
            src="/assets/bonus_image_2.png"
            alt="Bonus Easter Egg 2"
            style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
          />
        </Box>
        <Box sx={{ mt: 2, flexBasis: "100%", textAlign: "left" }}>
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            Aww, I could never stay mad at you, Cursor {"\u2764\ufe0f"}
          </Typography>
        </Box>
        <Box sx={{ mt: 15, flexBasis: "100%", textAlign: "left" }}>
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            PS: I am literally a professional software engineer.
          </Typography>
        </Box>
        <Box sx={{ mt: 55, display: "flex", justifyContent: "left", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <img
            src="/assets/bonus_image_3.png"
            alt="Bonus Easter Egg 3"
            style={{ maxWidth: "75%", height: "auto", borderRadius: "8px" }}
          />
        </Box>
        <Box sx={{ mt: 2, flexBasis: "100%", textAlign: "left" }}>
          <Typography variant="body2" sx={{ fontSize: "75px" }}>
            {"\uD83D\uDE11"}
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default About;
