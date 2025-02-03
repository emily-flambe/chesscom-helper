import React from "react";
import { Container, Typography, Box, Link } from "@mui/material";
import { GitHub, Email } from "@mui/icons-material";

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
          Chess.com has a <i>very</i> {" "}
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
        <Box sx={{ mt: 3 }}>
          <Link
            href="https://github.com/emily-flambe/chesscom-helper"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: "inline-flex", alignItems: "center", mx: 1 }}
          >
            <GitHub sx={{ mr: 0.5 }} />
            GitHub Repo
          </Link>
          <Link
            href="mailto:emilyflambe@gmail.com"
            sx={{ display: "inline-flex", alignItems: "center", mx: 1 }}
          >
            <Email sx={{ mr: 0.5 }} />
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
        <Box sx={{ flexBasis: "100%", textAlign: "left" }}>  {/* Ensures text takes full width */}
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
