// ==UserScript==
// @name     YouTube Video Queue
// @version  0.1
// @grant    lalalalalalala
// @include https://www.youtube.com/* 
// ==/UserScript==

(function(document_like, window_like){
    var ytq_session_key = "ytqSessionStorageKey";
    var ytq_local_key = "ytqLocalStorageKey";
    var ytq_storage_request = "ytqLocalStorageRequest";
    var ytq_storage_retrieve = "ytqLocalStorageRetrieve";
    var ytq_current_playing_key = "ytqCurrentPlayingIdx";
    var ytq_playback_queue_key = "ytqPlaybackQueue";
    var ytq_playback_offset_key = "ytqPlaybackOffset";
    var ytq_list_video_title_key = "title";
    var ytq_list_video_url_key = "url";
    var ytq_storage_event_handle = -1;
    
    var video_query_interval = 500; // ms

    
    var session_data;
    
    var yt_player_element = "video";
    var yt_player;
    // var yt_load_event_handle_new = -1;
    // var yt_load_event_handle_old = -1;
    var yt_video_end_handle = -1;
    var event_handles = [];
    var click_handles = [];
    var ytq_queued_hrefs = [];
    var handlers_init = false;

    var yt_floating_css = ".video-ytq\
    {\
        margin-top: 0;\
        margin-right: 0;\
        padding: 1px 2px;\
        font-weight: 500;\
        font-size: 11px;\
        background-color: #000;\
        color: #fff !important;\
        height: 14px;\
        line-height: 14px;\
        opacity: .75;\
        vertical-align: top;\
        display: inline-block;\
        position: absolute;\
        left: 2px;\
        bottom: 2px;\
        cursor: pointer;\
        word-wrap: break-word;\
        white-space: normal;\
        z-index: 1;\
    }"; // inherits from .video-time in yt

    var yt_selectors = [
        {
            parent: 'li.yt-shelf-grid-item',
            parentAdding: 'span.yt-thumb-simple',
            childExtracting: 'a.yt-ui-ellipsis'
        },
        {
            parent: 'div.yt-lockup-tile',
            parentAdding: 'span.yt-thumb-simple',
            childExtracting: 'a.yt-ui-ellipsis'            
        },
        {
            parent: 'li.related-list-item',
            parentAdding: 'span.yt-uix-simple-thumb-related',
            childExtracting: 'a.content-link'

        }
    ];

    yt_comment_box_selector = 'div.comment-simplebox-text';
    
    var storageTransfer = function(event){
        // if(!event.newValue){
        //     return;
        // }
        console.log(event.key)
        if(event.key == ytq_storage_request){
            window_like.localStorage.setItem(ytq_storage_retrieve, window_like.sessionStorage.getItem(ytq_session_key));
            window_like.setTimeout(function(){
                window_like.localStorage.removeItem(ytq_storage_retrieve);
            }, 100);
        }
        else if(event.key == ytq_storage_retrieve){
            var session_storage_data = event.newValue;
            window_like.sessionStorage[ytq_session_key] = session_storage_data;
        }
    }


    var updateLocalHrefs = function(){
        for(var _i = 0; _i < session_data[ytq_playback_queue_key].length; _i++){
            ytq_queued_hrefs[_i] = session_data[ytq_playback_queue_key][_i]['url'];
        }
    }


    var writeLocalStorage = function(){
        window_like.localStorage.setItem(ytq_local_key, JSON.stringify(session_data));
        updateLocalHrefs();
    }


    var readLocalStorage = function(){
        session_data = JSON.parse(window_like.localStorage.getItem(ytq_local_key));
        updateLocalHrefs();
    }


    var initialize = function(){
        console.log('initialize');
        if(!handlers_init){
            addStyleSheet();
            _tmp = window_like.addEventListener("storage", storageTransfer, false);
            event_handles[event_handles.length] = _tmp;
            _tmp = window_like.addEventListener("spfdone", function(){
                console.log('spfdone');
                console.log(handlers_init);
                removeElements();
                addElements();
            });
            event_handles[event_handles.length] = _tmp;        
            _tmp = window_like.addEventListener("yt-navigate-finish", function(){
                console.log('yt-navigate-finish');
                removeElements();
                addElements();
            });
            event_handles[event_handles.length] = _tmp;
            _tmp = window_like.addEventListener('keyup', function(_event){
                if(_event.target.tagName != 'INPUT' && _event.target != document_like.querySelector(yt_comment_box_selector)){
                    if(_event.keyCode == 78){
                        nextVideo();
                    }
                    if(_event.keyCode == 80){
                        previousVideo();
                    }
                }
            })
            event_handles[event_handles.length] = _tmp;
            initSessionManager();
            window_like.setTimeout(function(){
                var active_session = isActiveSession();
                if(!active_session){
                    session_data = {
                        "ytqCurrentPlayingIdx" : -1,
                        "ytqPlaybackOffset" : 0,
                        "ytqPlaybackQueue" : []
                    }
                    writeLocalStorage();
                }
                else{
                    readLocalStorage();
                    session_data[ytq_playback_offset_key] = 0;
                    writeLocalStorage();                
                }
            }, 50);
            window_like.setTimeout(function(){
                yt_player = document_like.querySelector(yt_player_element);
                console.log("setTimeout_getPlayerState");
                if(yt_player != null){
                    yt_video_end_handle = yt_player.addEventListener('ended', function(){
                        console.log('video end');
                        nextVideo();
                });
                    event_handles[event_handles.length] = _tmp;               
                }
            }, 50);
            handlers_init = true;
        }
              
        window_like.setTimeout(function(){
            console.log('adding elem');
            removeElements();
            addElements();
            watcher();
            console.log('watching');
        }, 100);
    }
    

    var addStyleSheet = function(){
        var style = document_like.createElement('style');
        style.type = 'text/css';
        style.innerHTML = yt_floating_css;
        document_like.getElementsByTagName('head')[0].appendChild(style);
    }


    var hrefParser = function(href){
        if(href.includes('www.youtube.com')){
            return href;
        }
        else{
            return 'https://www.youtube.com' + href;
        }
    }


    var handleQueueClick = function(e){
        e.stopPropagation();
        e.preventDefault();
        if(e.target.dataset.queued == '0'){
            e.target.dataset.queued = '1';
            e.target.textContent = 'Queued';
            addToQueue(e.target.dataset.href, e.target.title, e.target.dataset.src);
        }
        else{
            e.target.dataset.queued = '0';            
            e.target.textContent = 'Queue';
            removeFromQueue(e.target.dataset.href);
        }
        return false;
    }


    var addElements = function(){
        yt_selectors.forEach(function(selectors){
            to_add_shelf = document_like.querySelectorAll(selectors['parent']);
            console.log('added elem');
            to_add_shelf.forEach(function(item_shelf){
                a = item_shelf.querySelector(selectors['childExtracting'])
                if(!a){
                    return;
                }
                span = document_like.createElement('span');
                span.className = 'video-ytq';
                if(!a.href || !a.title){
                    return;
                }
                _href = hrefParser(a.href);
                span.dataset.href = _href
                span.title = a.title;
                if(ytq_queued_hrefs.includes(_href)){
                    span.textContent = 'Queued';
                    span.dataset.queued = '1';
                }
                else{
                    span.textContent = 'Queue';
                    span.dataset.queued = '0';
                }
                img_element = item_shelf.querySelector('img');
                if(!img_element){
                    return;
                }
                span.dataset.src = img_element.src;
                parent_to_add_element = item_shelf.querySelector(selectors['parentAdding']);
                if(!parent_to_add_element){
                    return;
                }
                parent_to_add_element.appendChild(span);
                _tmp = span.addEventListener('click', handleQueueClick, true);
                click_handles[click_handles.length] = _tmp;
            });
        });
    }


    var addToQueue = function(href, title, thumb){
        readLocalStorage();
        session_data[ytq_playback_queue_key][session_data[ytq_playback_queue_key].length] = {
            "title": title,
            "url": href,
            "thumb": thumb
        };
        writeLocalStorage();
    }


    var removeFromQueue = function(href){
        readLocalStorage();
        _i = ytq_queued_hrefs.indexOf(href);
        if(_i > -1){
            session_data[ytq_playback_queue_key].splice(_i, 1);
        }
        writeLocalStorage();
    }


    var removeElements = function(){
        to_remove = document_like.querySelectorAll('span.video-ytq');
        to_remove.forEach(function(element){
            element.removeEventListener('click', handleQueueClick, true);
            element.parentNode.removeChild(element);
        });
    }


    var mutationCallback = function(mutationsList) {
        for(var mutation of mutationsList) {
            if (mutation.target.tagName != 'SPAN') {
                removeElements();
                addElements();
            }
        }
    }


    var watcher = function(){
        var targetNode = document_like.querySelector('div#content');
        var config = { attributes: false, childList: true, subtree: true };
        var observer = new MutationObserver(mutationCallback);
        observer.observe(targetNode, config);
    }


    var destruct = function(){
        if(yt_player != null){
            yt_player.removeEventListener(yt_video_end_handle);
        }
    }

    
    var initSessionManager = function(){
        window_like.localStorage.setItem(ytq_storage_request, "null");
        window_like.localStorage.removeItem(ytq_storage_request);
    }
    
    
    var isActiveSession = function(){
        if(!window_like.sessionStorage.getItem(ytq_session_key)){
            window_like.sessionStorage.setItem(ytq_session_key, "null");
            console.log("created new")
            return false;
        }
        else{
            console.log("old")
            return true;
        }
    }


    var nextVideo = function(){
        changeVideo(0);
    }


    var previousVideo = function(){
        changeVideo(-2);
    }


    var changeVideo = function(offset_num){
        readLocalStorage();
        session_data[ytq_playback_offset_key] = offset_num;
        next_id = session_data[ytq_current_playing_key] + session_data[ytq_playback_offset_key] + 1;
        console.log("next_id " + next_id);        
        jump(next_id);
    }


    var jump = function(next_id){
        if(next_id < 0 || next_id >= session_data[ytq_playback_queue_key].length){
            return;
        }
        next_url = session_data[ytq_playback_queue_key][next_id][ytq_list_video_url_key];
        session_data[ytq_current_playing_key] = next_id;
        writeLocalStorage();
        console.log(next_url)
        window_like.location.href = next_url;
    }

    
    initialize();
})(document, window);