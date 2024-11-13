import { App, Modal, Notice, normalizePath, requestUrl } from "obsidian";

import { searchPaper } from "./arxiv";
import noteTemplate from "./note_template";

export class ImportModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;

		contentEl.createEl("h4", {
			text: "Import Paper from arXiv",
		});
		contentEl.createEl("p", {
			text: "Enter the arXiv ID or URL of the paper you want to import. Press Enter to confirm.",
			attr: { style: "margin-bottom: 20px; color: gray" },
		});
		contentEl.createEl("input", {
			attr: {
				type: "text",
				style: "width: 100%;",
				id: "paper-title-input",
			},
		});

		contentEl.addEventListener("keypress", async (e) => {
			if (e.key === "Enter") {
				new Notice("Searching for paper...");

				const paper = (
					contentEl.querySelector(
						"#paper-title-input"
					) as HTMLInputElement
				).value;

				let arxivId: string;
				try {
					arxivId = this.extractArxivId(paper);
				} catch (error) {
					new Notice(error.message);
					return;
				}

				try {
					await this.searchAndImportPaper(arxivId);
				} catch (error) {
					new Notice(error.message);
				}

				new Notice("Paper imported!");

				this.close();
			}
		});
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}

	async searchAndImportPaper(arxivId: string) {
		const paper = await searchPaper(arxivId);

		const pdfFolder = (this.app as any).plugins.plugins["paper_importer"]
			.settings.pdfFolder;

		if (!(await this.app.vault.adapter.exists(normalizePath(pdfFolder)))) {
			await this.app.vault.createFolder(pdfFolder);
		}

		const pdfFolderPath = this.app.vault.getFolderByPath(pdfFolder)!;
		const pdfPath = normalizePath(
			`${pdfFolderPath.path}/${paper.title} (${paper.paperId}).pdf`
		);

		const response = await requestUrl(paper.pdfUrl);
		await this.app.vault.adapter.writeBinary(pdfPath, response.arrayBuffer);

		const noteFolder = (this.app as any).plugins.plugins["paper_importer"]
			.settings.noteFolder;

		if (!(await this.app.vault.adapter.exists(normalizePath(noteFolder)))) {
			await this.app.vault.createFolder(noteFolder);
		}

		const noteFolderPath = this.app.vault.getFolderByPath(noteFolder)!;
		const notePath = normalizePath(
			`${noteFolderPath.path}/${paper.title} (${paper.paperId}).md`
		);
		const noteContent = noteTemplate
			.replace(/{{\s*paper_id\s*}}/g, paper.paperId)
			.replace(/{{\s*title\s*}}/g, paper.title)
			.replace(/{{\s*authors\s*}}/g, paper.authors.join(", "))
			.replace(/{{\s*date\s*}}/g, paper.date)
			.replace(/{{\s*abstract\s*}}/g, `"${paper.abstract}"`)
			.replace(/{{\s*comments\s*}}/g, `"${paper.comments}"`)
			.replace(/{{\s*pdf_link\s*}}/g, `"[[${pdfPath}]]"`);

		await this.app.vault.adapter.write(notePath, noteContent);
	}

	extractArxivId(text: string): string {
		// Match against arXiv:xxxx.xxxx or arxiv:xxxx.xxxxx
		const arxivIdPattern = /^arXiv:(\d{4}\.\d{4,5})$/;
		const match = text.match(arxivIdPattern);
		if (match) {
			return match[match.length - 1];
		}

		// Match against xxxx.xxxx or xxxx.xxxxx
		const idPattern = /^\d{4}\.\d{4,5}$/;
		const idMatch = text.match(idPattern);
		if (idMatch) {
			return idMatch[0];
		}

		// Match against arxiv.org/abs/xxxx.xxxx or arxiv.org/abs/xxxx.xxxxx or
		// arxiv.org/pdf/xxxx.xxxx or arxiv.org/pdf/xxxx.xxxxx
		const urlPattern =
			/^(https?:\/\/)?(www\.)?arxiv\.org\/(abs|pdf)\/(\d{4}\.\d{4,5})$/;
		const urlMatch = text.match(urlPattern);
		if (urlMatch) {
			return urlMatch[urlMatch.length - 1];
		}

		throw new Error("Invalid arXiv ID or URL");
	}
}
