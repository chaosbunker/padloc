import { until } from "lit-html/directives/until.js";
import { VaultItemID, Field } from "@padloc/core/lib/item.js";
import { localize as $l } from "@padloc/core/lib/locale.js";
import { AttachmentInfo } from "@padloc/core/lib/attachment.js";
import { parseURL } from "@padloc/core/lib/otp.js";
import { formatDateFromNow, fileIcon, fileSize } from "../util.js";
import { mixins } from "../styles";
import { alert, confirm, dialog } from "../dialog.js";
import { app, router } from "../init.js";
import { setClipboard } from "../clipboard.js";
import { element, html, css, property, query, queryAll } from "./base.js";
import { Dialog } from "./dialog.js";
import "./icon.js";
import { Input } from "./input.js";
import { TagsInput } from "./tags-input.js";
import { MoveItemsDialog } from "./move-items-dialog.js";
import { FieldElement } from "./field.js";
import "./field.js";
import { Generator } from "./generator.js";
import { AttachmentDialog } from "./attachment-dialog.js";
import { UploadDialog } from "./upload-dialog.js";
import { QRDialog } from "./qr-dialog.js";

@element("pl-item-dialog")
export class ItemDialog extends Dialog<string, void> {
    @property()
    itemId: VaultItemID = "";

    get _item() {
        const found = (this.itemId && app.getItem(this.itemId)) || null;
        return found && found.item;
    }

    get _vault() {
        const found = (this.itemId && app.getItem(this.itemId)) || null;
        return found && found.vault;
    }

    @property({ reflect: true, attribute: "editing" })
    private _editing: Boolean = false;

    @property()
    private _fields: Field[] = [];

    @query("#nameInput")
    private _nameInput: Input;

    @query("pl-tags-input")
    private _tagsInput: TagsInput;

    @queryAll("pl-field")
    private _fieldInputs: FieldElement[];

    @query("input[type='file']")
    private _fileInput: HTMLInputElement;

    @dialog("pl-move-items-dialog")
    private _moveItemsDialog: MoveItemsDialog;

    @dialog("pl-generator")
    private _generator: Generator;

    @dialog("pl-attachment-dialog")
    private _attachmentDialog: AttachmentDialog;

    @dialog("pl-upload-dialog")
    private _uploadDialog: UploadDialog;

    @dialog("pl-qr-dialog")
    private _qrDialog: QRDialog;

    async show(itemId: string) {
        this._editing = false;
        this.itemId = itemId;
        await this.updateComplete;
        this._itemChanged();
        // Workaround for weird bug where name input is sometimes empty after opening dialog
        setTimeout(() => this._itemChanged(), 200);
        return super.show();
    }

    dismiss() {
        super.dismiss();
        router.go("items");
    }

    static styles = [
        ...Dialog.styles,
        css`
            .inner {
                max-width: 500px;
                min-height: 500px;
                background: var(--color-quaternary);
                display: flex;
                flex-direction: column;
            }

            header {
                display: block;
            }

            .body {
                flex: 1;
                padding-bottom: 100px;
                ${mixins.scroll()}
            }

            .header-inner {
                display: flex;
                align-items: center;
            }

            .close-icon {
                width: 30px;
                height: 30px;
                font-size: var(--font-size-default);
                margin-right: -5px;
                margin-top: -1px;
            }

            .name {
                padding: 0 10px;
                line-height: 40px;
            }

            :host([editing]) .name {
                border: dashed 1px var(--color-shade-3);
            }

            pl-tags-input {
                margin: 16px;
            }

            .fields > * {
                margin: 12px;
            }

            :host(:not([editing])) pl-field:hover {
                background: #eee;
            }

            .updated {
                text-align: center;
                font-size: var(--font-size-tiny);
                color: var(--color-shade-4);
                font-weight: 600;
                margin: 30px;
            }

            .updated::before {
                font-family: FontAwesome;
                font-size: 80%;
                content: "\\f303";
                display: inline-block;
                margin-right: 4px;
            }

            .attachment {
                display: flex;
                align-items: center;
                padding: 12px;
            }

            .attachment-body {
                flex: 1;
                width: 0;
            }

            .attachment .file-icon {
                font-size: 150%;
                margin: 0 4px 0 -4px;
            }

            .attachment-name {
                font-size: var(--font-size-small);
                font-weight: bold;
                line-height: 1.5em;
            }

            .attachment-size {
                font-size: var(--font-size-tiny);
            }

            .attachment-remove {
                margin: 0 8px 0 -8px;
            }

            .favorite {
                color: var(--color-secondary);
                width: 40px;
                height: 40px;
                font-size: var(--font-size-default);
                opacity: 0.3;
                cursor: pointer;
                transition: transform 0.2s cubic-bezier(0.05, 0.7, 0.03, 3) 0s;
            }

            .favorite:hover {
                opacity: 0.6;
            }

            .favorite[active] {
                color: var(--color-negative);
                opacity: 1;
                transform: scale(1.1);
            }

            .editing {
                text-align: center;
                padding: 8px;
                margin: 0 0 0 12px;
                box-shadow: rgba(0, 0, 0, 0.3) 0 1px 3px;
                border-radius: var(--border-radius);
                background: rgba(255, 255, 255, 0.9);
            }

            .actions {
                margin: 16px;
            }

            .actions > button {
                font-size: var(--font-size-small);
                background: none;
                padding: 10px 8px 10px 0;
                border: dashed 1px;
                font-weight: bold;
            }

            .actions > button.negative {
                color: var(--color-negative);
                border-color: var(--color-negative);
            }

            @media (max-width: 700px) {
                .outer {
                    padding: 0;
                }

                .inner {
                    border-radius: 0;
                    max-width: 100%;
                    width: 100%;
                    height: 100%;
                }
            }
        `
    ];

    renderContent() {
        if (app.state.locked || !this._item || !this._vault) {
            return html``;
        }

        const { updated, updatedBy, favorited } = this._item!;
        const vault = this._vault!;
        const org = vault.org && app.getOrg(vault.org.id);
        const readonly = !app.hasWritePermissions(vault);
        const updatedByMember = org && org.getMember({ id: updatedBy });
        const attachments = this._item!.attachments || [];
        const isFavorite = favorited && favorited.includes(app.account!.id);

        return html`
            <header>
                <div class="header-inner">
                    <pl-icon
                        icon="backward"
                        class="tap narrow close-icon"
                        @click=${this.dismiss}
                        ?hidden=${this._editing}
                    ></pl-icon>
                    <pl-input
                        id="nameInput"
                        class="name flex"
                        .placeholder=${$l("Enter Item Name")}
                        ?readonly=${!this._editing}
                    >
                    </pl-input>
                    <pl-icon
                        icon="favorite"
                        class="favorite"
                        ?active=${isFavorite}
                        @click=${() => this._setFavorite(!isFavorite)}
                    ></pl-icon>
                </div>
            </header>

            <div class="body">
                <pl-tags-input .editing=${this._editing} .vault=${this._vault} @move=${this._move}></pl-tags-input>

                <div class="fields">
                    ${this._fields.map(
                        (field: Field, index: number) => html`
                            <pl-field
                                class="item"
                                .name=${field.name}
                                .value=${field.value}
                                .type=${field.type}
                                .editing=${this._editing}
                                @edit=${() => this._editField(index)}
                                @copy=${() => setClipboard(this._item!, field)}
                                @remove=${() => this._removeField(index)}
                                @generate=${() => this._generateValue(index)}
                                @get-totp-qr=${() => this._getTotpQR(index)}
                            >
                            </pl-field>
                        `
                    )}
                </div>

                <div class="attachments">
                    ${attachments.map(
                        a => html`
                            <div
                                class="attachment item ${this._editing ? "" : "tap"}"
                                @click=${() => this._openAttachment(a)}
                            >
                                <pl-icon icon=${fileIcon(a.type)} class="file-icon" ?hidden=${this._editing}></pl-icon>
                                <pl-icon
                                    icon="remove"
                                    class="attachment-remove tap"
                                    ?hidden=${!this._editing}
                                    @click=${() => this._deleteAttachment(a)}
                                ></pl-icon>
                                <div class="attachment-body">
                                    <div class="attachment-name ellipsis">${a.name}</div>
                                    <div class="attachment-size">${fileSize(a.size)}</div>
                                </div>
                            </div>
                        `
                    )}
                </div>

                <div class="actions" ?hidden=${!this._editing}>
                    <button class="icon tap" @click=${() => this._addField()}>
                        <pl-icon icon="add"></pl-icon>
                        <div>${$l("Field")}</div>
                    </button>

                    <button class="icon tap" @click=${this._addAttachment}>
                        <pl-icon icon="attachment"></pl-icon>
                        <div>${$l("Attachment")}</div>
                    </button>

                    <button class="icon tap" @click=${this._move}>
                        <pl-icon icon="share"></pl-icon>
                        <div>${$l("Move")}</div>
                    </button>

                    <button class="icon tap negative" @click=${this._deleteItem}>
                        <pl-icon icon="delete"></pl-icon>
                        <div>${$l("Delete")}</div>
                    </button>
                </div>

                <div class="updated">
                    ${until(formatDateFromNow(updated!))}
                    ${updatedByMember && " " + $l("by {0}", updatedByMember.email)}
                </div>
            </div>

            <div class="fabs" ?hidden=${this._editing}>
                <div class="flex"></div>

                <pl-icon icon="edit" class="tap fab" @click=${() => this.edit()} ?disabled=${readonly}> </pl-icon>
            </div>

            <div class="fabs" ?hidden=${!this._editing}>
                <pl-icon icon="delete" class="destructive fab tap" @click=${() => this._deleteItem()} hidden></pl-icon>

                <pl-icon icon="share" class="fab tap" @click=${() => this._move()} hidden> </pl-icon>

                <pl-icon icon="check" class="fab primary tap" @click=${this.save}></pl-icon>

                <div class="editing flex">${$l("editing")}</div>

                <pl-icon icon="cancel" class="fab tap" @click=${this.cancelEdit}></pl-icon>
            </div>

            <input type="file" hidden @change=${this._attachFile} />
        `;
    }

    async edit() {
        if (!app.hasWritePermissions(this._vault!)) {
            return;
        }
        this._editing = true;
        await this.updateComplete;
        this._nameInput.focus();
    }

    async cancelEdit() {
        this._fields = this._getFields();
        await this.updateComplete;
        this._editing = false;
        this._itemChanged();
    }

    save() {
        app.updateItem(this._vault!, this._item!, {
            name: this._nameInput.value,
            fields: this._getFields(),
            tags: this._tagsInput.tags
        });
        this._editing = false;
    }

    private _getFields() {
        return [...this._fieldInputs].map((fieldEl: FieldElement) => {
            return {
                name: fieldEl.name,
                value: fieldEl.value,
                type: fieldEl.type
            };
        });
    }

    private _itemChanged() {
        const item = this._item!;
        this._nameInput.value = item.name;
        this._fields = item.fields.map(f => ({ ...f }));
        this._tagsInput.tags = [...item.tags];
    }

    private _removeField(index: number) {
        this._fields = this._fields.filter((_, i) => i !== index);
    }

    private async _deleteItem() {
        this.open = false;
        const confirmed = await confirm($l("Are you sure you want to delete this item?"), $l("Delete"), $l("Cancel"), {
            type: "destructive"
        });
        if (confirmed) {
            app.deleteItems([{ vault: this._vault!, item: this._item! }]);
            router.go("items");
        } else {
            this.open = true;
        }
    }

    private async _addField(field: Field = { name: "", value: "", type: "note" }) {
        this._fields.push(field);
        this.requestUpdate();
        await this.updateComplete;
        setTimeout(() => this._fieldInputs[this._fields.length - 1].focus(), 100);
    }

    private async _move() {
        if (!app.hasWritePermissions(this._vault!)) {
            return;
        }
        this.open = false;
        if (this._item!.attachments.length) {
            await alert($l("Items with attachments cannot be moved!"), { type: "warning" });
        } else {
            const movedItems = await this._moveItemsDialog.show([{ item: this._item!, vault: this._vault! }]);
            if (movedItems && movedItems.length) {
                router.go(`items/${movedItems[0].id}`);
            }
        }
        this.open = true;
    }

    private async _editField(index: number) {
        if (!app.hasWritePermissions(this._vault!)) {
            return;
        }
        this._editing = true;
        await this.updateComplete;
        this._fieldInputs[index].focus();
    }

    private async _generateValue(index: number) {
        this.open = false;
        const value = await this._generator.show();
        this.open = true;
        if (value) {
            this._fields[index].value = value;
        }
    }

    private _addAttachment() {
        if (this._vault!.id === app.mainVault!.id && !app.account!.quota.storage && app.billingConfig) {
            this.dispatch("get-premium", {
                message: $l("Upgrade to Premium now and get 1GB of encrypted file storage!"),
                icon: "storage"
            });
            this.done();
            return;
        }

        this._fileInput.click();
    }

    private async _attachFile() {
        const file = this._fileInput.files![0];
        this._fileInput.value = "";
        if (!file) {
            return;
        }

        if (file.size > 5e6) {
            alert($l("The selected file is too large! Only files of up to 5 MB are supported."), {
                type: "warning"
            });
            return;
        }

        this.open = false;
        const att = await this._uploadDialog.show({ item: this.itemId, file });
        if (att) {
            await alert($l("File uploaded successfully!"), { type: "success" });
        }
        this.open = true;
    }

    private async _openAttachment(info: AttachmentInfo) {
        if (this._editing) {
            return;
        }
        this.open = false;
        await this._attachmentDialog.show({ item: this.itemId, info });
        this.open = true;
    }

    private async _getTotpQR(index: number): Promise<void> {
        this.open = false;
        const data = await this._qrDialog.show();
        if (data) {
            try {
                const { secret } = parseURL(data);
                this._fields[index].value = secret;
            } catch (e) {
                await alert("Invalid Code! Please try again!", { type: "warning" });
                return this._getTotpQR(index);
            }
        }
        this.open = true;
    }

    private _setFavorite(favorite: boolean) {
        app.updateItem(this._vault!, this._item!, { favorite });
        this.requestUpdate();
    }

    private async _deleteAttachment(a: AttachmentInfo) {
        const confirmed = await confirm(
            $l("Are you sure you want to delete this attachment?"),
            $l("Delete"),
            $l("Cancel"),
            {
                title: $l("Delete Attachment"),
                type: "destructive"
            }
        );
        if (confirmed) {
            await app.deleteAttachment(this.itemId!, a);
            this.requestUpdate();
        }
    }
}
