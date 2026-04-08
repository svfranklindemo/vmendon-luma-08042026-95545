export default function decorate(block) {
  const row = block.children[0];
  if (!row) return;

  const [titleCell, descCell] = [...row.children];
  if (titleCell) titleCell.className = 'ih-title';
  if (descCell) descCell.className = 'ih-desc';
}
