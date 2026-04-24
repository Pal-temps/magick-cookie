import { render } from "solid-js/web";
import { I18nProvider } from "./i18n/context";
import { App } from "./App";
import "./ui/styles/global.css";

// Pre-load all view CSS to avoid FOUC on lazy-loaded views
import "./ui/styles/ide.css";
import "./ui/styles/workflow-editor.css";
import "./ui/styles/notes.css";
import "./ui/styles/email.css";
import "./ui/styles/rss.css";
import "./ui/styles/cicd.css";
import "./ui/styles/taskjar.css";
import "./ui/styles/dashboard.css";
import "./ui/styles/cookwser.css";
import "./ui/styles/passwords.css";

render(() => <I18nProvider><App /></I18nProvider>, document.getElementById("root")!);
