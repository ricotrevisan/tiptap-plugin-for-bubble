if (instance.data.tocRoot && instance.data.tocClickHandler) {
    instance.data.tocRoot.removeEventListener("click", instance.data.tocClickHandler);
}
instance.data.tocRoot?.replaceChildren();
instance.data.tocStyle?.remove();
instance.data.tocRoot?.remove();
instance.data.tocItems = [];
instance.data.tocAnchors = new Map();
instance.data.tocStructureSignature = "";
instance.data.tocClickHandler = null;
instance.data.renderTableOfContents = null;
