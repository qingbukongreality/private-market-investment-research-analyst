import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/simple-layout.css";
import "../app/flow-layout.css";
import "../app/mechanical.css";
import "../app/refinements.css";
import "../app/independent.css";
import "../app/cancel.css";
import "../app/safety.css";
import "../app/features.css";
import "../app/refresh.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><Home /></React.StrictMode>);
