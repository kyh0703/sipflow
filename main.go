package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create native File menu
	appMenu := menu.NewMenu()
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("New Project", keys.CmdOrCtrl("n"), func(cd *menu.CallbackData) {
		app.projectService.NewProject()
	})
	fileMenu.AddText("Open Project...", keys.CmdOrCtrl("o"), func(cd *menu.CallbackData) {
		app.projectService.OpenProject()
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("Save", keys.CmdOrCtrl("s"), func(cd *menu.CallbackData) {
		// Save needs frontend canvas state, so emit event for frontend to handle
		runtime.EventsEmit(app.ctx, "menu:save")
	})
	fileMenu.AddText("Save As...", keys.CmdOrCtrl("shift+s"), func(cd *menu.CallbackData) {
		app.projectService.SaveProjectAs()
	})

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "sipflow",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Menu:             appMenu,
		Bind: []interface{}{
			app,
			app.flowService,
			app.sipService,
			app.projectService,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
