# Terax web shell integration. Sourced via: bash --rcfile <this> -i
# Interactive bash ignores PS1/PROMPT_COMMAND passed via the environment, so the
# prompt + shell-integration escapes are installed here instead.

# Load the system interactive base config, then layer our prompt on top. We do
# NOT source "$HOME/.bashrc": HOME points at the SHARED workspace, so sourcing a
# workspace .bashrc would let any user auto-run startup code in everyone else's
# terminals. The terminal is full container access by design, but silently
# tampering with other users' shell startup is a UX hazard we avoid.
if [ -f /etc/bash.bashrc ]; then . /etc/bash.bashrc; fi

# OSC 7 reports the working directory so the app's status bar tracks the cwd.
__terax_osc7() { printf '\033]7;file://%s%s\a' "${HOSTNAME:-localhost}" "$PWD"; }
case "$PROMPT_COMMAND" in
  *__terax_osc7*) ;;
  "") PROMPT_COMMAND="__terax_osc7" ;;
  *) PROMPT_COMMAND="__terax_osc7; $PROMPT_COMMAND" ;;
esac

# OSC 133;A marks the prompt start; the visible prompt is the cyan working dir.
PS1='\[\e]133;A\a\]\[\e[36m\]\w\[\e[0m\] $ '

# Terax arcade: launchable terminal mini-games with shared leaderboards.
if [ -n "$TERAX_GAMES_DIR" ]; then
  alias games='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/launcher.mjs"'
  alias arcade='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/launcher.mjs"'
  alias snake='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/snake.mjs"'
  alias minesweeper='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/minesweeper.mjs"'
  alias mines='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/minesweeper.mjs"'
  alias dungeon='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/dungeon.mjs"'
  alias 2048='"${TERAX_NODE:-node}" "$TERAX_GAMES_DIR/2048.mjs"'
  printf '\033[2mtip: type \033[0m\033[1;36mgames\033[0m\033[2m to play the arcade (snake \302\267 mines \302\267 dungeon \302\267 2048)\033[0m\n'
fi
