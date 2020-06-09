import React, {useState, useEffect} from 'react';
import { Container, Navbar, Button, FormControl, Form} from "react-bootstrap";
import config from '../config';
import axios from "axios";
import firebase from "firebase";
const d3 = require("d3");



function Graph(props) {    
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [movies, setMovies] = useState({});
    const [newMovieID, setNewMovieID] = useState("");
    const [shouldRender, setShouldRender] = useState(true);


    function handleIDValidation() {
        if (newMovieID === "") {
          alert("ID cannot be empty.");
        } else if (newMovieID.length != 9) {
          alert("ID should be 9 characters.");
        } else return true;
        return false;
    }
    
    function handleAddMovie(e) {
        e.preventDefault();
        if (handleIDValidation()) {
            axios.get("https://www.omdbapi.com/?apikey=fe15e914&i=" + newMovieID)
                .then((response) => {
                    firebase.database().ref("GraphMovies/" + newMovieID)
                        .set(response.data);
                }
            );
            setNewMovieID(0);
            alert("New movie submitted.");
        }
    }

    useEffect(() => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        let ref = firebase.database().ref('GraphMovies');        
        ref.once('value', (snapshot) => {
            const val = snapshot.val();
            const keys = Object.keys(val);
            setMovies(val);
            var node_objs = [];
            var link_objs = [];
            for(var i = 0; i < keys.length; i++) {
                node_objs.push({
                    type: "movie",
                    id: keys[i],
                    poster: val[keys[i]].Poster
                });
                const actors = val[keys[i]].Actors.split(", ");
                for(let j = 0; j < actors.length; j++) {
                    if(!(node_objs.some((elem) => elem.id === actors[j]))) {
                        node_objs.push({
                            type: "actor",
                            id: actors[j]
                        });
                    }
                    link_objs.push({
                        source: keys[i],
                        target: actors[j]
                    });
                }
            }
            setNodes(node_objs);
            setLinks(link_objs);
            const elem = document.getElementById("svg");
            elem.appendChild(graph(node_objs, link_objs));
        })
    }, [shouldRender])

    const drag = (simulation, label) => {
        const dragStart = (d) => {
            if(!d3.event.active) {
                simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;                
            }
        }

        const dragging = (d) => {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
            label.attr("x", d.x)
                .attr("y", d.y - 30);
        }

        const dragStop = (d) => {
            if(!d3.event.active) {
                simulation.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
        }

        return d3.drag()
            .on("start", dragStart)
            .on("drag", dragging)
            .on("end", dragStop);
    }

    const graph = (node_objs, link_objs) => {
        const width = 2000;
        const height = 1000;

        const obj_nodes = node_objs.map(obj => Object.create(obj));
        const obj_links = link_objs.map(obj => Object.create(obj));

        const svg = d3.create("svg")
            .attr("viewBox", [0, 0, width, height]);

        var defs = svg.append("svg:defs");

        node_objs.forEach((d, i) => {
            if(d.type === "movie") {
                defs.append("svg:pattern")
                    .attr("id", "poster_" + d.id)
                    .attr("width", 1) 
                    .attr("height", 1)
                    .attr("patternUnits", "objectBoundingBox")
                    .append("svg:image")
                    .attr("xlink:href", d.poster)
                    .attr("width", 300)
                    .attr("height", 300)
                    .attr("x", -50)
                    .attr("y", -50);
            }
        })

        const link = svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.5)
            .selectAll("line")
            .data(obj_links)
            .join("line")
            .attr("stroke-width", 4);

        const radius = (node) => {
            if(node.type === "movie") {
                return 90;
            }
            else if(node.type === "actor") {
                return 20;
            }
        }

        const color = (node) => {
            if(node.type === "movie") {
                return "url(#poster_" + node.id + ")";
            }
            else if(node.type === "actor") {
                return "steelblue";
            }
        }

        const simulation = d3.forceSimulation(obj_nodes)
            .force("link", d3.forceLink().links(link_objs).id(d => { return d.id; }).distance(180))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(width / 2, height / 2));

        const label = svg.append("text")
            .attr("id", "label")
            .attr("font-size", 30)
            .attr("opacity", 0)
            .style("text-anchor", "middle")
            .text("");

        const node = svg.append("g")
            .selectAll("circle")
            .data(obj_nodes)
            .join("circle")
            .attr("r", radius)
            .style("fill", color)
            .call(drag(simulation, label));

        node.on("mouseover", (d) => {
            if(d.type === "actor") {
                var c = d3.select(this);
                label
                    .raise()
                    .attr("opacity", 1)
                    .attr("x", d.x)
                    .attr("y", d.y - 25)
                    .text(d.id);
            }
        })
        .on("mouseout", (d) => {
            if(d.type === "actor") {
                label
                    .attr("opacity", 0)
                    .text(d.id);
            }
        });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        })
        
        return svg.node();
    }

    return (
        <div>
            <Navbar bg = "light" expand = "lg">
                Misha's Movie Graph App
                <Form inline className = "m-a" onSubmit = {(e) => e.preventDefault()}>
                    <FormControl 
                        className = "ml-5"
                        type = "text"
                        onChange = {(e) => {{e.preventDefault(); console.log(e.target.value); setNewMovieID(e.target.value)}}}
                    />
                    <Button
                        className = "ml-5"
                        variant = "outline-success"
                        onClick = {(e) => handleAddMovie(e)}
                    > Submit Movie ID </Button>
                </Form>
            </Navbar>
            <div id="svg"/>
        </div>
        
    );
}

export default Graph;