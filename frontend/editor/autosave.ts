import { debounce } from "lodash";

const autosave = (editor: { getData: () => string; model: { document: { on: (event: string, callback: () => void) => void } } }, saveCallback: (html: string) => Promise<void>) => {
	const saveChanges = debounce(async () => {
		const html = editor.getData();
		try {
			await saveCallback(html);
			console.log("Autosave successful");
		} catch (error) {
			console.error("Autosave failed:", error);
		}
	}, 2000);

	editor.model.document.on("change:data", saveChanges);
};

export default autosave;
