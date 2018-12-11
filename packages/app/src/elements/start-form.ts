import { Invite } from "@padloc/core/lib/invite.js";
import { shared, mixins } from "../styles";
import { BaseElement, html, property } from "./base.js";
import { animateCascade } from "../animation.js";
import "./icon.js";

export const sharedStyles = html`
    ${shared}

    <style>
        @keyframes reveal {
            from { transform: translate(0, 30px); opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes fade {
            to { transform: translate(0, -200px); opacity: 0; }
        }

        :host {
            ${mixins.fullbleed()}
            ${mixins.scroll()}
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        form {
            width: 100%;
            max-width: 400px;
        }

        form > * {
            border-radius: 8px;
            margin: 10px;
        }

        pl-logo {
            margin: 30px auto;
        }

        pl-loading-button {
            overflow: hidden;
            font-weight: bold;
        }
    </style>
`;

export abstract class StartForm extends BaseElement {
    @property()
    public invite?: Invite;

    reset() {
        animateCascade(this.$$(".animate"), {
            animation: "reveal",
            duration: 1000,
            fullDuration: 1500,
            initialDelay: 300,
            fill: "backwards",
            clear: 3000
        });
        this.requestUpdate();
    }

    done() {
        animateCascade(this.$$(".animate"), {
            animation: "fade",
            duration: 400,
            fullDuration: 600,
            initialDelay: 0,
            fill: "forwards",
            easing: "cubic-bezier(1, 0, 0.2, 1)",
            clear: 3000
        });
    }
}