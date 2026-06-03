/** Text button with Nothing-flavoured variants. */
export function Button({ variant = 'default', block = false, className = '', ...props }) {
  const classes = [
    'ui-btn',
    variant !== 'default' && `ui-btn--${variant}`,
    block && 'ui-btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...props} />;
}

/** Compact square button for row actions (move / delete / duplicate). */
export function IconButton({ danger = false, className = '', ...props }) {
  const classes = ['ui-iconbtn', danger && 'ui-iconbtn--danger', className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={classes} {...props} />;
}
