if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Find");

if (!instance.data.ext.findreplace) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Find", "Find & Replace");
}

const editor = instance.data.editor;
const storage = editor.storage.findAndReplace;
const searchTerm = properties.search_term || "";
const caseSensitive = properties.case_sensitive === true;
const useRegex = properties.use_regex === true;
const wholeWord = properties.whole_word === true;
const direction = properties.direction === "previous" ? "previous" : "next";

if (!searchTerm) {
    editor.commands.clearSearch();
    return;
}

const isNewSearch =
    storage.searchTerm !== searchTerm ||
    storage.caseSensitive !== caseSensitive ||
    storage.useRegex !== useRegex ||
    storage.wholeWord !== wholeWord;

if (storage.caseSensitive !== caseSensitive) editor.commands.setCaseSensitive(caseSensitive);
if (storage.useRegex !== useRegex) editor.commands.setUseRegex(useRegex);
if (storage.wholeWord !== wholeWord) editor.commands.setWholeWord(wholeWord);

if (isNewSearch) {
    editor.commands.setSearchTerm(searchTerm);

    if (direction === "previous") {
        editor.commands.goToPreviousResult();
    } else {
        const firstResult = editor.storage.findAndReplace.results[0];
        if (firstResult) {
            editor.commands.setTextSelection(firstResult);
            editor.view.dispatch(editor.state.tr.scrollIntoView());
        }
    }
} else if (direction === "previous") {
    editor.commands.goToPreviousResult();
} else {
    editor.commands.goToNextResult();
}