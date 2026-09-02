namespace $ {

	/**
	 * Включает запись сессии при загрузке бандла.
	 * Подключается через `include \/bog/rec/take/auto` в meta.tree приложения.
	 *
	 * Настройки берутся из взвода, оставленного прошлой загрузкой
	 * (`$bog_rec_take.arm()`), поэтому автосброс переживает перезагрузку.
	 *
	 * Без объявленного в разметке корня записывать нечего: так модуль молчит
	 * и в ноде, где приложения нет вовсе.
	 */
	function $bog_rec_take_auto() {
		if( !$bog_rec_take.root() ) return
		$bog_rec_take.start( $bog_rec_take.armed() )
	}

	if( $bog_rec_take.root() ) {
		$bog_rec_take_auto()
	} else {
		$mol_dom_context.document?.addEventListener(
			'DOMContentLoaded',
			$bog_rec_take_auto,
			{ once: true },
		)
	}

}
