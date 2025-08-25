import "clsx";
function _layout($$payload, $$props) {
  let { children } = $$props;
  $$payload.out.push(`<div class="100dvw 100dvh relative flex flex-row" style="font-family:'HP Simplified'">`);
  children($$payload);
  $$payload.out.push(`<!----></div>`);
}
export {
  _layout as default
};
