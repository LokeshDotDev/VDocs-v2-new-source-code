const completeEditing = async (fileId: string) => {
	try {
		const response = await fetch(`/api/editor/${fileId}/complete`, {
			method: "POST",
		});
		if (response.ok) {
			console.log("Editing completed successfully");
		} else {
			console.error("Failed to complete editing");
		}
	} catch (error: unknown) {
		console.error("Error completing editing:", error);
	}
};

export default completeEditing;
