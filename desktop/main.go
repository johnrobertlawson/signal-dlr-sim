// The installer's executable contains the built game and serves it only on loopback.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

//go:embed dist
var game embed.FS

func openWindow(url string) error {
	var candidates []string
	switch runtime.GOOS {
	case "darwin":
		candidates = []string{"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"}
	case "linux":
		candidates = []string{"google-chrome", "chromium", "chromium-browser", "microsoft-edge"}
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	for _, candidate := range candidates {
		if browser, err := exec.LookPath(candidate); err == nil {
			cmd := exec.Command(browser, "--app="+url, "--window-size=1560,960", "--no-first-run", "--user-data-dir="+filepath.Join(configDir, "dlr-signalling-sim", "browser"))
			if err := cmd.Start(); err == nil {
				go cmd.Wait()
				return nil
			}
		}
	}
	opener := "xdg-open"
	if runtime.GOOS == "darwin" {
		opener = "/usr/bin/open"
	}
	cmd := exec.Command(opener, url)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}

func run() error {
	if runtime.GOOS == "linux" && os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		return fmt.Errorf("launch DLR Signalling Sim from your graphical desktop")
	}
	ln, err := net.Listen("tcp4", "127.0.0.1:18573")
	if err != nil {
		ln, err = net.Listen("tcp4", "127.0.0.1:0")
		if err != nil {
			return err
		}
	}
	defer ln.Close()
	host := ln.Addr().String()
	url := "http://" + host
	mux := http.NewServeMux()
	var mu sync.Mutex
	clients := 0
	deadline := time.Now().Add(90 * time.Second)
	mux.HandleFunc("/__dlr/window", func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "stream unavailable", 500)
			return
		}
		mu.Lock()
		clients++
		mu.Unlock()
		defer func() { mu.Lock(); clients--; deadline = time.Now().Add(15 * time.Second); mu.Unlock() }()
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		fmt.Fprint(w, ": open\n\n")
		flusher.Flush()
		<-r.Context().Done()
	})
	files, err := fs.Sub(game, "dist")
	if err != nil {
		return err
	}
	mux.Handle("/", http.FileServer(http.FS(files)))
	server := &http.Server{ReadHeaderTimeout: 5 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != host {
			http.Error(w, "invalid host", http.StatusForbidden)
			return
		}
		mux.ServeHTTP(w, r)
	})}
	go func() {
		for range time.Tick(time.Second) {
			mu.Lock()
			idle := clients == 0 && time.Now().After(deadline)
			mu.Unlock()
			if idle {
				server.Close()
				return
			}
		}
	}()
	if err := openWindow(url); err != nil {
		return err
	}
	err = server.Serve(ln)
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}

func main() {
	if err := run(); err != nil {
		msg := "Could not open DLR Signalling Sim. " + err.Error()
		if runtime.GOOS == "darwin" {
			exec.Command("/usr/bin/osascript", "-e", "on run argv\ndisplay alert \"DLR Signalling Sim\" message (item 1 of argv)\nend run", msg).Run()
		} else if strings.TrimSpace(os.Getenv("DISPLAY")+os.Getenv("WAYLAND_DISPLAY")) != "" {
			exec.Command("zenity", "--error", "--text", msg).Run()
		}
		log.Fatal(msg)
	}
}
