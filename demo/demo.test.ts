namespace $ {

	$mol_test({

		/**
		 * Прокликивание как обычный тест: приложение монтируется в jsdom,
		 * фаззер дёргает его обработчики, падение на экране роняет тест.
		 *
		 * Таймеры в тестах замоканы, поэтому паузу между шагами прокручиваем вручную.
		 */
		async 'фаззер не находит ошибок в подопытном приложении'( $ ) {

			/**
			 * jsdom держит свои классы на своём окне, а `$mol_view_selection.focused`
			 * смотрит на глобальный `ShadowRoot`. Без этого любой сфокусированный
			 * `$mol_string` роняет рендер в ноде.
			 */
			const globals = globalThis as { ShadowRoot?: typeof ShadowRoot }
			globals.ShadowRoot ??= $.$mol_dom_context.ShadowRoot

			/**
			 * Рекордер поднимаем ДО первого рендера: слушатели вешаются один раз,
			 * и вид, отрисованный раньше подмены, так и останется неперехваченным.
			 * В приложении это обеспечивает автозапуск при загрузке бандла.
			 */
			$bog_rec_take.start()

			const doc = $.$mol_dom_context.document

			const app = new $.$bog_rec_demo
			app.$ = $

			doc.body.appendChild( app.dom_node() )
			app.dom_tree()

			const report = await $bog_rec_fuzz.run({
				root: app,
				steps: 20,
				seed: 42,
				/// Иначе фаззер нажмёт «Прокликать» и запустит сам себя
				allow: view => view !== app.Fuzz() && view !== app.Save(),
				settle: async ()=> {
					$mol_after_mock_warp()
					await Promise.resolve()
				},
			})

			app.destructor()

			$mol_assert_equal( report.errors, [] )
			$mol_assert_ok( report.steps > 0 )
			$mol_assert_ok( ( report.session?.events.length ?? 0 ) > 0 )

		},

	})

}
